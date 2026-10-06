# Forensic Learning Record (Deep Inspection): openstatusHQ/openstatus

> **Canonical Artifact**: `07_PROJECT_LEARNING/openstatushq-openstatus-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/openstatusHQ/openstatus](https://github.com/openstatusHQ/openstatus))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:20:27.892Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `openstatusHQ/openstatus`
- **Description**: 🫖 Status page with uptime monitoring & API monitoring as code   🫖
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 9169 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/dashboard/src/app/api/webhooks/workos/route.ts`
```
import { db } from "@openstatus/db";
import type { ServiceContext } from "@openstatus/services";
import { NotFoundError } from "@openstatus/services";
import {
  getWorkspaceByWorkosOrganization,
  isWorkOSConfigured,
  removeSsoDomain,
  syncSsoDomain,
  verifyWorkOSWebhook,
} from "@openstatus/services/sso";
import type { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const secret = process.env.WORKOS_WEBHOOK_SECRET;
  if (!isWorkOSConfigured() || !secret) {
    return new Response("Not found", { status: 404 });
  }

  const sigHeader = req.headers.get("workos-signature");
  if (!sigHeader) return new Response("No signature", { status: 400 });

  const payload = await req.text();

  const event = await verifyWorkOSWebhook({
    payload,
    sigHeader,
    secret,
  }).catch(() => null);

  if (!event) return new Response("Invalid signature", { status: 400 });
  if (event.type === "ignored") return new Response("OK", { status: 200 });

  const { organizationId, domain } = event;

  try {
    const workspace = await getWorkspaceByWorkosOrganization(
      db,
      organizationId,
    );
    const ctx: ServiceContext = {
      workspace,
      actor: { type: "system", job: "workos-webhook" },
    };

    if (event.type === "domain.verified") {
      await syncSsoDomain({
        ctx,
        input: { organizationId, domain, verifiedAt: new Date() },
      });
    } else {
      await removeSsoDomain({ ctx, input: { organizationId, domain } });
    }
  } catch (error) {
    // An organization with no mapped workspace is not worth retrying:
    // acknowledge so WorkOS stops redelivering.
    if (error instanceof NotFoundError) {
      return new Response("OK", { status: 200 });
    }
    throw error;
  }

  return new Response("OK", { status: 200 });
}

```

### Core Architecture Module: `apps/dashboard/src/components/chat/tool-renderers/add-status-report-update.tsx`
```
import type { AgentToolInput } from "@openstatus/services/agent-tools";
import { formatComponentImpacts } from "@openstatus/services/status-report/utils";

import type { ChangeRow } from "@/components/common/changes-table";

type Input = AgentToolInput<"add_status_report_update">;

type Applied = {
  statusReportUpdateId: number;
  notified?: boolean;
};

export function addStatusReportUpdateChanges(
  input: Input,
  applied?: Applied,
): ChangeRow[] {
  const changes: ChangeRow[] = [
    { field: "statusReportId", after: input.statusReportId },
    { field: "status", after: input.status },
    { field: "message", after: input.message },
    {
      field: "notify",
      after: applied?.notified !== undefined ? applied.notified : input.notify,
    },
  ];
  if (input.componentImpacts?.length) {
    changes.push({
      field: "componentImpacts",
      after: formatComponentImpacts(input.componentImpacts),
    });
  }
  if (input.date) {
    changes.push({ field: "date", after: input.date });
  }
  return changes;
}

```

### Core Architecture Module: `apps/dashboard/src/components/chat/tool-renderers/create-maintenance.tsx`
```
import type { AgentToolInput } from "@openstatus/services/agent-tools";

import type { ChangeRow } from "@/components/common/changes-table";

type Input = AgentToolInput<"create_maintenance">;

type Applied = {
  id: number;
  notified?: boolean;
};

export function createMaintenanceChanges(
  input: Input,
  applied?: Applied,
): ChangeRow[] {
  return [
    { field: "title", after: input.title },
    { field: "message", after: input.message },
    { field: "from", after: input.from },
    { field: "to", after: input.to },
    { field: "pageId", after: input.pageId },
    { field: "pageComponentIds", after: input.pageComponentIds },
    {
      field: "notify",
      after: applied?.notified !== undefined ? applied.notified : input.notify,
    },
  ];
}

```

### Core Architecture Module: `apps/dashboard/src/components/chat/tool-renderers/create-status-report.tsx`
```
import type { AgentToolInput } from "@openstatus/services/agent-tools";
import { formatComponentImpacts } from "@openstatus/services/status-report/utils";

import type { ChangeRow } from "@/components/common/changes-table";

type Input = AgentToolInput<"create_status_report">;

type Applied = {
  id: number;
  notified?: boolean;
  /**
   * Server-set creation timestamp. Used as the fallback `date` value
   * when the input didn't override (server defaults `date` to `now()`).
   */
  createdAt?: string | null;
};

export function createStatusReportChanges(
  input: Input,
  applied?: Applied,
): ChangeRow[] {
  const changes: ChangeRow[] = [
    { field: "title", after: input.title },
    { field: "status", after: input.status },
    { field: "message", after: input.message },
    { field: "pageId", after: input.pageId },
    {
      field: "notify",
      after: applied?.notified !== undefined ? applied.notified : input.notify,
    },
  ];

  if (input.pageComponentIds?.length) {
    changes.push({
      field: "pageComponentIds",
      after: input.pageComponentIds,
    });
  }

  if (input.componentImpacts?.length) {
    changes.push({
      field: "componentImpacts",
      after: formatComponentImpacts(input.componentImpacts),
    });
  }

  const resolvedDate = input.date ?? undefined;
  if (resolvedDate !== undefined) {
    changes.push({ field: "date", after: resolvedDate });
  }

  if (applied?.createdAt) {
    changes.push({ field: "createdAt", after: applied.createdAt });
  }

  return changes;
}

```

### Core Architecture Module: `apps/dashboard/src/components/chat/tool-renderers/details-table.tsx`
```
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "@openstatus/ui/components/ui/table";
import { Fragment, type ReactNode } from "react";

export type DetailsRow = {
  label: string;
  value: ReactNode;
};

export type DetailsSection = {
  title?: string;
  rows: DetailsRow[];
};

export type DetailsTableData = {
  sections: DetailsSection[];
  empty?: string;
};

export function DetailsTable({ sections, empty }: DetailsTableData) {
  const total = sections.reduce((acc, s) => acc + s.rows.length, 0);
  if (total === 0) {
    return (
      <div className="bg-background text-muted-foreground rounded-md border p-3 text-sm">
        {empty ?? "No details to show."}
      </div>
    );
  }
  return (
    <div className="bg-background overflow-hidden rounded-md border">
      <Table>
        <TableBody>
          {sections.map((section, sIdx) => (
            <Fragment key={section.title ?? sIdx}>
              {section.title ? (
                <TableRow className="hover:bg-transparent">
                  <TableHead colSpan={2}>{section.title}</TableHead>
                </TableRow>
              ) : null}
              {section.rows.map((row) => (
                <TableRow
                  key={`${sIdx}-${row.label}`}
                  className="hover:bg-transparent"
                >
                  <TableHead className="bg-muted/40 text-muted-foreground w-1/3 border-r font-mono">
                    {row.label}
                  </TableHead>
                  <TableCell className="font-mono break-words whitespace-normal">
                    {row.value}
                  </TableCell>
                </TableRow>
              ))}
            </Fragment>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

```

### Core Architecture Module: `apps/dashboard/src/components/chat/tool-renderers/get-audit-log.tsx`
```
import type { AgentToolOutput } from "@openstatus/services/agent-tools";

import {
  type ChangeRow,
  buildAuditLogChangeRows,
} from "@/components/common/changes-table";

type Output = AgentToolOutput<"get_audit_log">;

export function getAuditLogChanges(output: Output): ChangeRow[] {
  return buildAuditLogChangeRows({
    before: output.before,
    after: output.after,
    changedFields: output.changedFields,
  });
}

```

### Core Architecture Module: `apps/dashboard/src/components/chat/tool-renderers/get-monitor-status.tsx`
```
import type { AgentToolOutput } from "@openstatus/services/agent-tools";
import { cn } from "@openstatus/ui/lib/utils";

import { TableCellRegion } from "@/components/data-table/table-cell-region";

import type { ResultTableData } from "./result-table";

type Output = AgentToolOutput<"get_monitor_status">;

const statusColor: Record<Output["regions"][number]["status"], string> = {
  active: "text-success",
  degraded: "text-warning",
  error: "text-destructive",
};

export function getMonitorStatusTable(
  output: Output,
): ResultTableData<"region" | "status"> {
  return {
    empty: "No regions reporting yet.",
    columns: [
      { key: "region", header: "Region" },
      { key: "status", header: "Status" },
    ],
    rows: output.regions.map((r) => ({
      id: r.region,
      cells: {
        region: <TableCellRegion value={r.region} className="font-mono" />,
        status: (
          <div className={cn("font-mono", statusColor[r.status])}>
            {r.status}
          </div>
        ),
      },
    })),
  };
}

```

### Core Architecture Module: `apps/dashboard/src/components/chat/tool-renderers/get-monitor-summary.tsx`
```
import type {
  AgentToolInput,
  AgentToolOutput,
} from "@openstatus/services/agent-tools";

import { TableCellDate } from "@/components/data-table/table-cell-date";
import { TableCellNumber } from "@/components/data-table/table-cell-number";
import { TableCellText } from "@/components/data-table/table-cell-text";

import type { DetailsTableData } from "./details-table";

type Input = AgentToolInput<"get_monitor_summary">;
type Output = AgentToolOutput<"get_monitor_summary">;

export function getMonitorSummaryDetails(
  input: Input,
  output: Output,
): DetailsTableData {
  const lastPingDate = output.lastPingAt ? new Date(output.lastPingAt) : null;
  return {
    sections: [
      {
        title: "Monitor",
        rows: [
          {
            label: "ID",
            value: <TableCellNumber value={output.monitorId} />,
          },
          { label: "Window", value: <TableCellText value={input.timeRange} /> },
          {
            label: "Last check",
            value: <TableCellDate value={lastPingDate} />,
          },
        ],
      },
      {
        title: "Checks",
        rows: [
          {
            label: "Successful",
            value: (
              <TableCellNumber
                value={output.totalSuccessful}
                className="text-success"
              />
            ),
          },
          {
            label: "Degraded",
            value: (
              <TableCellNumber
                value={output.totalDegraded}
                className="text-warning"
              />
            ),
          },
          {
            label: "Failed",
            value: (
              <TableCellNumber
                value={output.totalFailed}
                className="text-destructive"
              />
            ),
          },
        ],
      },
      {
        title: "Latency",
        rows: [
          {
            label: "p50",
            value: <TableCellNumber value={output.p50} unit="ms" />,
          },
          {
            label: "p75",
            value: <TableCellNumber value={output.p75} unit="ms" />,
          },
          {
            label: "p90",
            value: <TableCellNumber value={output.p90} unit="ms" />,
          },
          {
            label: "p95",
            value: <TableCellNumber value={output.p95} unit="ms" />,
          },
          {
            label: "p99",
            value: <TableCellNumber value={output.p99} unit="ms" />,
          },
        ],
      },
    ],
  };
}

```

### Core Architecture Module: `apps/dashboard/src/components/chat/tool-renderers/get-monitor.tsx`
```
import type {
  AgentToolInput,
  AgentToolOutput,
} from "@openstatus/services/agent-tools";

import { TableCellBoolean } from "@/components/data-table/table-cell-boolean";
import { TableCellNumber } from "@/components/data-table/table-cell-number";
import { TableCellText } from "@/components/data-table/table-cell-text";

import type {
  DetailsRow,
  DetailsSection,
  DetailsTableData,
} from "./details-table";

type Input = AgentToolInput<"get_monitor">;
type Output = AgentToolOutput<"get_monitor">;

export function getMonitorDetails(
  _input: Input,
  output: Output,
): DetailsTableData {
  const identity: DetailsRow[] = [
    { label: "ID", value: <TableCellNumber value={output.id} /> },
    { label: "Name", value: <TableCellText value={output.name} /> },
    { label: "URL", value: <TableCellText value={output.url} /> },
    {
      label: "Type",
      value: <TableCellText value={output.jobType.toUpperCase()} />,
    },
  ];
  if (output.method) {
    identity.push({
      label: "Method",
      value: <TableCellText value={output.method} />,
    });
  }
  identity.push({
    label: "Active",
    value: <TableCellBoolean value={output.active} />,
  });

  const behavior: DetailsRow[] = [
    {
      label: "Periodicity",
      value: <TableCellText value={output.periodicity} />,
    },
    {
      label: "Regions",
      value: <TableCellText value={output.regions.join(", ")} />,
    },
    {
      label: "Timeout",
      value: <TableCellNumber value={output.timeout} unit="ms" />,
    },
  ];
  if (output.degradedAfter !== null) {
    behavior.push({
      label: "Degraded after",
      value: <TableCellNumber value={output.degradedAfter} unit="ms" />,
    });
  }
  behavior.push(
    { label: "Retry", value: <TableCellNumber value={output.retry} /> },
    {
      label: "Follow redirects",
      value: <TableCellBoolean value={output.followRedirects} />,
    },
  );

  const visibility: DetailsRow[] = [
    { label: "Public", value: <TableCellBoolean value={output.public} /> },
    {
      label: "Tags",
      value: (
        <TableCellText value={output.tags.map((t) => t.name).join(", ")} />
      ),
    },
    {
      label: "Notifications",
      value: (
        <TableCellText
          value={output.notifications
            .map((n) => `${n.name} (${n.provider})`)
            .join(", ")}
        />
      ),
    },
  ];

  const sections: DetailsSection[] = [
    { title: "Monitor", rows: identity },
    { title: "Behavior", rows: behavior },
    { title: "Visibility", rows: visibility },
  ];
  if (output.privateLocationIds.length > 0) {
    sections.push({
      title: "Private locations",
      rows: [
        {
          label: "IDs",
          value: <TableCellText value={output.privateLocationIds.join(", ")} />,
        },
      ],
    });
  }
  return { sections };
}

```

### Core Architecture Module: `apps/dashboard/src/components/chat/tool-renderers/get-response-log.tsx`
```
import type {
  AgentToolInput,
  AgentToolOutput,
} from "@openstatus/services/agent-tools";

import { TableCellBoolean } from "@/components/data-table/table-cell-boolean";
import { TableCellDate } from "@/components/data-table/table-cell-date";
import { TableCellNumber } from "@/components/data-table/table-cell-number";
import { TableCellRegion } from "@/components/data-table/table-cell-region";
import { TableCellText } from "@/components/data-table/table-cell-text";

import type {
  DetailsRow,
  DetailsSection,
  DetailsTableData,
} from "./details-table";

type Input = AgentToolInput<"get_response_log">;
type Output = AgentToolOutput<"get_response_log">;
type Timing = NonNullable<Output["timing"]>;

export function getResponseLogDetails(
  _input: Input,
  output: Output,
): DetailsTableData {
  const request: DetailsRow[] = [
    { label: "Log ID", value: <TableCellText value={output.id} /> },
    { label: "Monitor", value: <TableCellText value={output.monitorId} /> },
    { label: "Region", value: <TableCellRegion value={output.region} /> },
    { label: "URL", value: <TableCellText value={output.url} /> },
    {
      label: "Status",
      value: <TableCellText value={output.requestStatus} />,
    },
    {
      label: "Status code",
      value: <TableCellNumber value={output.statusCode} />,
    },
    {
      label: "Latency",
      value: <TableCellNumber value={output.latency} unit="ms" />,
    },
    {
      label: "Timestamp",
      value: <TableCellDate value={new Date(output.timestamp)} />,
    },
    { label: "Trigger", value: <TableCellText value={output.trigger} /> },
    { label: "Error", value: <TableCellBoolean value={output.error} /> },
  ];

  const sections: DetailsSection[] = [{ rows: request }];

  if (Object.keys(output.headers).length > 0) {
    sections.push({
      rows: [
        {
          label: "Headers",
          value: (
            <pre className="text-foreground break-all whitespace-pre-wrap">
              {JSON.stringify(output.headers, null, 2)}
            </pre>
          ),
        },
      ],
    });
  }

  if (output.timing) {
    sections.push({
      rows: timingRows(output.timing, output.latency),
    });
  }

  if (output.message) {
    sections.push({
      rows: [
        { label: "Message", value: <TableCellText value={output.message} /> },
      ],
    });
  }

  if (output.body) {
    sections.push({
      rows: [
        {
          label: "Body",
          value: (
            <pre className="text-foreground break-all whitespace-pre-wrap">
              {output.body}
            </pre>
          ),
        },
      ],
    });
  }

  if (output.assertions) {
    sections.push({
      rows: [
        {
          label: "Assertions",
          value: <TableCellText value={output.assertions} />,
        },
      ],
    });
  }

  return { sections };
}

function timingRows(timing: Timing, latency: number): DetailsRow[] {
  const denom = latency || 1;
  return Object.entries(timing).map(([key, value], index) => ({
    label: key.toUpperCase(),
    value: (
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground">
          {new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(
            (value / denom) * 100,
          )}
          %
        </span>
        <div className="flex flex-1 items-center justify-end gap-1">
          <span className="text-muted-foreground text-nowrap">{value} ms</span>
          <div
            className="h-3"
            style={{
              width: `${(value / denom) * 100}%`,
              backgroundColor: `var(--chart-${index + 1})`,
            }}
          />
        </div>
      </div>
    ),
  }));
}

```

### Core Architecture Module: `apps/dashboard/src/components/chat/tool-renderers/incidents.tsx`
```
import type {
  AgentToolInput,
  AgentToolOutput,
} from "@openstatus/services/agent-tools";

import type { ChangeRow } from "@/components/common/changes-table";
import { TableCellDate } from "@/components/data-table/table-cell-date";
import { TableCellNumber } from "@/components/data-table/table-cell-number";
import { TableCellText } from "@/components/data-table/table-cell-text";

import type { DetailsTableData } from "./details-table";
import type { ResultTableData } from "./result-table";

export function listIncidentsTable(
  output: AgentToolOutput<"list_incidents">,
): ResultTableData<"title" | "severity" | "status" | "commander" | "id"> {
  const items = output?.items ?? [];
  return {
    empty: "No incidents.",
    columns: [
      { key: "title", header: "Title" },
      { key: "severity", header: "Severity" },
      { key: "status", header: "Status" },
      { key: "commander", header: "Commander" },
      { key: "id", header: "ID" },
    ],
    rows: items.map((i) => ({
      id: i.id,
      cells: {
        title: <TableCellText value={i.title} />,
        severity: <TableCellText value={i.severity} />,
        status: (
          <TableCellText value={i.closed ? `${i.status} · closed` : i.status} />
        ),
        commander: <TableCellText value={i.commander?.name ?? null} />,
        id: <TableCellNumber value={i.id} />,
      },
    })),
  };
}

export function getIncidentDetails(
  output: AgentToolOutput<"get_incident">,
): DetailsTableData {
  return {
    sections: [
      {
        rows: [
          { label: "ID", value: <TableCellNumber value={output.id} /> },
          { label: "Title", value: <TableCellText value={output.title} /> },
          {
            label: "Severity",
            value: <TableCellText value={output.severity} />,
          },
          { label: "Status", value: <TableCellText value={output.status} /> },
          {
            label: "Commander",
            value: <TableCellText value={output.commander?.name ?? null} />,
          },
          {
            label: "Summary",
            value: <TableCellText value={output.summary} />,
          },
          {
            label: "Started",
            value: <TableCellDate value={new Date(output.startedAt)} />,
          },
          {
            label: "Status report",
            value: <TableCellText value={output.statusReport?.title ?? null} />,
          },
        ],
      },
      {
        title: "Timeline",
        rows: output.events.slice(0, 10).map((e) => ({
          label: e.type.replaceAll("_", " "),
          value: <TableCellText value={e.message} />,
        })),
      },
    ],
  };
}

export function declareIncidentChanges(
  input: AgentToolInput<"declare_incident">,
  result?: { id: number },
): ChangeRow[] {
  const changes: ChangeRow[] = [];
  if (result) changes.push({ field: "id", after: result.id });
  changes.push(
    { field: "title", after: input.title },
    { field: "severity", after: input.severity },
  );
  if (input.summary) changes.push({ field: "summary", after: input.summary });
  if (input.commanderId !== undefined) {
    changes.push({ field: "commanderId", after: input.commanderId });
  }
  if (input.startedAt) {
    changes.push({ field: "startedAt", after: input.startedAt });
  }
  if (input.statusReportId !== undefined) {
    changes.push({ field: "statusReportId", after: input.statusReportId });
  }
  return changes;
}

export function updateIncidentChanges(
  input: AgentToolInput<"update_incident">,
): ChangeRow[] {
  const changes: ChangeRow[] = [{ field: "incidentId", after: input.id }];
  for (const field of [
    "title",
    "severity",
    "summary",
    "commanderId",
    "startedAt",
  ] as const) {
    if (input[field] !== undefined) {
      changes.push({ field, after: input[field] });
    }
  }
  return changes;
}

export function resolveIncidentChanges(
  input: AgentToolInput<"resolve_incident">,
): ChangeRow[] {
  const changes: ChangeRow[] = [
    { field: "incidentId", after: input.id },
    { field: "status", after: "resolved" },
  ];
  if (input.note) changes.push({ field: "note", after: input.note });
  return changes;
}

```

### Core Architecture Module: `apps/dashboard/src/components/chat/tool-renderers/index.tsx`
```
import type {
  AgentToolInput,
  AgentToolName,
  AgentToolOutput,
} from "@openstatus/services/agent-tools";
import type { ReactNode } from "react";

import {
  type ChangeRow,
  ChangesTable,
} from "@/components/common/changes-table";

import { addStatusReportUpdateChanges } from "./add-status-report-update";
import { createMaintenanceChanges } from "./create-maintenance";
import { createStatusReportChanges } from "./create-status-report";
import { DetailsTable } from "./details-table";
import { getAuditLogChanges } from "./get-audit-log";
import { getMonitorDetails } from "./get-monitor";
import { getMonitorStatusTable } from "./get-monitor-status";
import { getMonitorSummaryDetails } from "./get-monitor-summary";
import { getResponseLogDetails } from "./get-response-log";
import {
  declareIncidentChanges,
  getIncidentDetails,
  listIncidentsTable,
  resolveIncidentChanges,
  updateIncidentChanges,
} from "./incidents";
import { listAuditLogsTable } from "./list-audit-logs";
import { listMaintenancesTable } from "./list-maintenances";
import { listMonitorsTable } from "./list-monitors";
import { listNotificationsTable } from "./list-notifications";
import { listPageComponentsTable } from "./list-page-components";
import { listPrivateLocationsTable } from "./list-private-locations";
import { listResponseLogsTable } from "./list-response-logs";
import { listStatusPagesTable } from "./list-status-pages";
import { listStatusReportsTable } from "./list-status-reports";
import { resolveStatusReportChanges } from "./resolve-status-report";
import { ResultTable } from "./result-table";
import { searchContentTable } from "./search-content";
import { searchDocsTable } from "./search-docs";
import { updateStatusReportChanges } from "./update-status-report";

/**
 * Per-tool renderer keyed by `AgentToolName` so each entry's input/output
 * carry the tool's concrete schema — schema drift becomes a type error here.
 * Tools without an entry fall back to the raw JSON disclosure.
 */
export type ToolRenderer<N extends AgentToolName> = {
  renderDraft?: (input: AgentToolInput<N>) => ChangeRow[];
  renderResult?: (params: {
    input: AgentToolInput<N>;
    output: AgentToolOutput<N>;
  }) => ReactNode;
  summary?: (output: AgentToolOutput<N>) => string | undefined;
};

/**
 * Required map (no `?`) so adding a tool to `agentTools` without a
 * renderer entry is a TS error here. Tools that don't need a custom
 * renderer can opt in with `{}` — explicit, not silent.
 */
export type ToolRendererRegistry = {
  [N in AgentToolName]: ToolRenderer<N>;
};

export const toolRenderers: ToolRendererRegistry = {
  // ── Read tools ───────────────────────────────────────────────
  list_status_pages: {
    renderResult: ({ output }) => (
      <ResultTable {...listStatusPagesTable(output)} />
    ),
    summary: (o) => itemsCountSummary(o.items),
  },
  list_page_components: {
    renderResult: ({ output }) => (
      <ResultTable {...listPageComponentsTable(output)} />
    ),
    summary: (o) => itemsCountSummary(o.items),
  },
  list_status_reports: {
    renderResult: ({ output }) => (
      <ResultTable {...listStatusReportsTable(output)} />
    ),
    summary: (o) => itemsCountSummary(o.items),
  },
  list_maintenances: {
    renderResult: ({ output }) => (
      <ResultTable {...listMaintenancesTable(output)} />
    ),
    summary: (o) => itemsCountSummary(o.items),
  },

  // ── Destructive tools ────────────────────────────────────────
  create_status_report: {
    renderDraft: (input) => createStatusReportChanges(input),
    renderResult: ({ input, output }) => (
      <ChangesTable
        changes={createStatusReportChanges(input, {
          id: output.statusReport.id,
          notified: output.notified,
          createdAt: output.statusReport.createdAt,
        })}
      />
    ),
    summary: (o) => `ID ${o.statusReport.id}`,
  },
  add_status_report_update: {
    renderDraft: (input) => addStatusReportUpdateChanges(input),
    renderResult: ({ input, output }) => (
      <ChangesTable
        changes={addStatusReportUpdateChanges(input, {
          statusReportUpdateId: output.statusReportUpdateId,
          notified: output.notified,
        })}
      />
    ),
    summary: (o) => `update #${o.statusReportUpdateId}`,
  },
  update_status_report: {
    renderDraft: (input) => updateStatusReportChanges(input),
    renderResult: ({ input }) => (
      <ChangesTable changes={updateStatusReportChanges(input)} />
    ),
    summary: (o) => `ID ${o.id}`,
  },
  resolve_status_report: {
    renderDraft: (input) => resolveStatusReportChanges(input),
    renderResult: ({ input, output }) => (
      <ChangesTable
        changes={resolveStatusReportChanges(input, {
          statusReportUpdateId: output.statusReportUpdateId,
          notified: output.notified,
        })}
      />
    ),
    summary: (o) => `resolved · update #${o.statusReportUpdateId}`,
  },
  create_maintenance: {
    renderDraft: (input) => createMaintenanceChanges(input),
    renderResult: ({ input, output }) => (
      <ChangesTable
        changes={createMaintenanceChanges(input, {
          id: output.id,
          notified: output.notified,
        })}
      />
    ),
    summary: (o) => `ID ${o.id}`,
  },
  list_incidents: {
    renderResult: ({ output }) => (
      <ResultTable {...listIncidentsTable(output)} />
    ),
    summary: (o) => itemsCountSummary(o.items),
  },
  get_incident: {
    renderResult: ({ output }) => (
      <DetailsTable {...getIncidentDetails(output)} />
    ),
    summary: (o) => `${o.severity} · ${o.status}`,
  },
  declare_incident: {
    renderDraft: (input) => declareIncidentChanges(input),
    renderResult: ({ input, output }) => (
      <ChangesTable changes={declareIncidentChanges(input, output)} />
    ),
    summary: (o) => `ID ${o.id}`,
  },
  update_incident: {
    renderDraft: (input) => updateIncidentChanges(input),
    renderResult: ({ input }) => (
      <ChangesTable changes={updateIncidentChanges(input)} />
    ),
    summary: (o) => `ID ${o.id}`,
  },
  resolve_incident: {
    renderDraft: (input) => resolveIncidentChanges(input),
    renderResult: ({ input }) => (
      <ChangesTable changes={resolveIncidentChanges(input)} />
    ),
    summary: (o) => `resolved · ID ${o.id}`,
  },
  set_incident_status: {
    renderDraft: (input) => [
      { field: "incidentId", after: input.id },
      { field: "status", after: input.status },
      ...(input.note ? [{ field: "note", after: input.note }] : []),
    ],
    summary: (o) => `${o.status} · ID ${o.id}`,
  },
  get_postmortem: {
    summary: (o) =>
      o.exists ? `${o.status} · drafted by ${o.draftedBy}` : "no postmortem",
  },
  draft_postmortem: {
    renderDraft: (input) => [
      { field: "incidentId", after: input.id },
      { field: "content", after: input.content },
    ],
    summary: (o) => `${o.status} · incident ${o.incidentId}`,
  },
  approve_postmortem: {
    renderDraft: (input) => [
      { field: "incidentId", after: input.id },
      { field: "close", after: input.close },
    ],
    summary: (o) => `${o.status} · incident ${o.incidentId}`,
  },
  add_incident_note: {
    summary: (o) => `note added to incident ${o.incidentId}`,
  },
  list_monitors: {
    renderResult: ({ output }) => (
      <ResultTable {...listMonitorsTable(output)} />
    ),
    summary: (o) => itemsCountSummary(o.items),
  },
  list_notifications: {
    renderResult: ({ output }) => (
      <ResultTable {...listNotificationsTable(output)} />
    ),
    summary: (o) => itemsCountSummary(o.items),
  },
  list_private_locations: {
    renderResult: ({ output }) => (
      <ResultTable {...listPrivateLocationsTable(output)} />
    ),
    summary: (o) => itemsCountSummary(o.items),
  },
  list_response_logs: {
    renderResult: ({ output }) => (
      <ResultTable {...listResponseLogsTable(output)} />
    ),
    summary: (o) =>
      `${o.logs.length} log${o.logs.length === 1 ? "" : "s"}${o.hasMore ? " (more available)" : ""}`,
  },
  get_monitor: {
    renderResult: ({ input, output }) => (
      <DetailsTable {...getMonitorDetails(input, output)} />
    ),
    summary: (o) => `ID ${o.id}`,
  },
  get_monitor_status: {
    renderResult: ({ output }) => (
      <ResultTable {...getMonitorStatusTable(output)} />
    ),
    summary: (o) =>
      `${o.regions.length} region${o.regions.length === 1 ? "" : "s"}`,
  },
  get_monitor_summary: {
    renderResult: ({ input, output }) => (
      <DetailsTable {...getMonitorSummaryDetails(input, output)} />
    ),
    summary: (o) =>
      `${o.totalSuccessful + o.totalDegraded + o.totalFailed} checks · p95 ${o.p95}ms`,
  },
  get_response_log: {
    renderResult: ({ input, output }) => (
      <DetailsTable {...getResponseLogDetails(input, output)} />
    ),
    summary: (o) => (o.id ? `log ${o.id}` : undefined),
  },
  list_audit_logs: {
    renderResult: ({ output }) => (
      <ResultTable {...listAuditLogsTable(output)} />
    ),
    summary: (o) => itemsCountSummary(o.items),
  },
  get_audit_log: {
    renderResult: ({ output }) => (
      <ChangesTable changes={getAuditLogChanges(output)} />
    ),
    summary: (o) => `${o.action} · #${o.id}`,
  },
  search_docs: {
    renderResult: ({ output }) => <ResultTable {...searchDocsTable(output)} />,
    summary: (o) => (o.error ? o.error : itemsCountSummary(o.results)),
  },
  // No renderResult — a full markdown page in the transcript is noise; the
  // summary line plus the model's cited answer is the UX.
  get_doc_page: {
    summary: (o) =>
      o.error ? o.error : `read ${o.url}${o.truncated ? " (truncated)" : ""}`,
  },
  search_content: {
    renderResult: ({ output }) => (
      <ResultTable {...searchContentTable(output)} />
    ),
    summary: (o) => (o.error ? o.error : itemsCountSummary(o.results)),
  },
  get_content_page: {
    summary: (o) =>
      o.error ? o.error : `read ${o.url}${o.truncated ? " (truncated)" : ""}`,
  },
};

function itemsCountSummary(items: u
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2849** (2026-10-05): **chore: web content incident management + drop feature flag**
  *Symptoms*:   <!-- This is an auto-generated description by cubic. --> <a href="https://cubic.dev/pr/openstatusHQ/openstatus/pull/2849?utm_source=github" target="_blank" rel="noopener noreferrer" data-no-image-dialog="true"><picture><source media="(prefers-color-scheme: dark)" srcset="https://www.cubic.dev/buttons/review-in-cubic-dark.svg"><source media="(prefers-color-scheme: light)" srcset="https://www.cubic.dev/buttons/review-in-cubic-light.svg"><img alt="Review in cubic" src="https://www.cubic.dev/buttons/review-in-cubic-dark.svg"></picture></a> <!-- End of auto-generated description by cubic. -->  
  **Post-Mortem & Fix Analysis**:
  > [vc]: #DoAs6uueDmI6eBUflLtpYvlrvmiYlJG8EXu4qBsPVks=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJvcGVuc3RhdHVzLXdlYiIsInByb2plY3RJZCI6InByal94NFlBcWZvaWhzNGdaOW5lRWVrTVZ4OU5scHpaIiwicm9vdERpcmVjdG9yeSI6ImFwcHMvd2ViIiwiaW5zcGVjdG9yVXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL29wZW4tc3RhdHVzL29wZW5zdGF0dXMtd2ViL0Y2WmpLOTZUWkR0S21aUTZBR0NEaTVFazVyYzUiLCJwcmV2aWV3VXJsIjoib3BlbnN0YXR1cy13ZWItZ2l0LWNob3JlLXdlYi1jb250ZW50LWluY2lkZW4tMjFmZmJiLW9wZW4tc3RhdHVzLnZlcmNlbC5hcHAiLCJuZXh0Q29tbWl0U3RhdHVzIjoiREVQTE9ZRUQiLCJsaXZlRmVlZGJhY2siOnsicmVzb2x2ZWQiOjAsInVucmVzb2x2ZWQiOjAsInRvdGFsIjowLCJsaW5rIjoib3BlbnN0YXR1cy13ZWItZ2l0LWNob3JlLXdlYi1jb250ZW50LWluY2lkZW4tMjFmZmJiLW9wZW4tc3RhdHVzLnZlcmNlbC5hcHAifSwidjAiOmZhbHNlfSx7Im5hbWUiOiJvcGVuc3RhdHVzLWRhc2hib2FyZCIsInByb2plY3RJZCI6InByal9Uc2F6YUhPN2NGcXRCS0dBa1JCTjdtMTgxTUpYIiwicm9vdERpcmVjdG9yeSI6ImFwcHMvZGFzaGJvYXJkIiwiaW5zcGVjdG9yVXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL29wZW4tc3RhdHVzL29wZW5zdGF0dXMtZGFzaGJvYXJkL2FWTkE3TFBBTTRQWHRraDhtemFjNkQy
  > @claude review
  > **Claude finished @mxkaske's task in 22s** —— [View job](https://github.com/openstatusHQ/openstatus/actions/runs/37343355050)  --- ### Review of #2849: web content for incident management  - [x] Read the diff and the repo conventions (`AGENTS.md`, `apps/web/AGENTS.md`) - [x] Reviewed the dashboard changes and the web content changes - [ ] Not run: `pnpm verify`, `pnpm verify:test`, and a rendered check of the demos. This session's shell permissions blocked a compound command, so I reviewed by reading only.  **Verdict:** no blocking issues. The notes below are minor.  ### Dashboard  - **Overview "Open Incidents" count** (`overview-events.client.ts`, `overview/page.tsx`)   - With incident management on, the stat now counts managed incidents instead of monitor downtime. That is the right call, and the `href: "/incidents"` link fits it.   - `openIncidents` isn't in the page's loading guard, so the stat can show `0` for a moment before the query resolves. Gate it, or pass `undefined` until 

- **Issue #2848** (2026-10-05): **stripe: improve email from**
  *Symptoms*:   <!-- This is an auto-generated description by cubic. --> <a href="https://cubic.dev/pr/openstatusHQ/openstatus/pull/2848?utm_source=github" target="_blank" rel="noopener noreferrer" data-no-image-dialog="true"><picture><source media="(prefers-color-scheme: dark)" srcset="https://www.cubic.dev/buttons/review-in-cubic-dark.svg"><source media="(prefers-color-scheme: light)" srcset="https://www.cubic.dev/buttons/review-in-cubic-light.svg"><img alt="Review in cubic" src="https://www.cubic.dev/buttons/review-in-cubic-dark.svg"></picture></a> <!-- End of auto-generated description by cubic. -->  
  **Post-Mortem & Fix Analysis**:
  > [vc]: #ZoUzX1ZyUqpYA9hCVMy01R/2Bm7DYTG9yy3kP2NXoRI=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJvcGVuc3RhdHVzLXdlYiIsInByb2plY3RJZCI6InByal94NFlBcWZvaWhzNGdaOW5lRWVrTVZ4OU5scHpaIiwidjAiOmZhbHNlLCJyb290RGlyZWN0b3J5IjoiYXBwcy93ZWIiLCJsaXZlRmVlZGJhY2siOnsicmVzb2x2ZWQiOjAsInVucmVzb2x2ZWQiOjAsInRvdGFsIjowLCJsaW5rIjoib3BlbnN0YXR1cy13ZWItZ2l0LXB1c2gtcHF4emxrcHVvb3dwLW9wZW4tc3RhdHVzLnZlcmNlbC5hcHAifSwiaW5zcGVjdG9yVXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL29wZW4tc3RhdHVzL29wZW5zdGF0dXMtd2ViLzRwaGhWdGt0ZENCenZDZG9aZlhlb1UxcVNSTXMiLCJwcmV2aWV3VXJsIjoib3BlbnN0YXR1cy13ZWItZ2l0LXB1c2gtcHF4emxrcHVvb3dwLW9wZW4tc3RhdHVzLnZlcmNlbC5hcHAiLCJuZXh0Q29tbWl0U3RhdHVzIjoiREVQTE9ZRUQifSx7Im5hbWUiOiJvcGVuc3RhdHVzLWRhc2hib2FyZCIsInByb2plY3RJZCI6InByal9Uc2F6YUhPN2NGcXRCS0dBa1JCTjdtMTgxTUpYIiwidjAiOmZhbHNlLCJyb290RGlyZWN0b3J5IjoiYXBwcy9kYXNoYm9hcmQiLCJsaXZlRmVlZGJhY2siOnsicmVzb2x2ZWQiOjAsInVucmVzb2x2ZWQiOjAsInRvdGFsIjowLCJsaW5rIjoib3BlbnN0YXR1cy1kYXNoYm9hcmQtZ2l0LXB1c2gtcHF4emxrcHVvb3dwLW9wZW4t

- **Issue #2847** (2026-10-05): **stripe: improve webhook**
  *Symptoms*:   <!-- This is an auto-generated description by cubic. --> <a href="https://cubic.dev/pr/openstatusHQ/openstatus/pull/2847?utm_source=github" target="_blank" rel="noopener noreferrer" data-no-image-dialog="true"><picture><source media="(prefers-color-scheme: dark)" srcset="https://www.cubic.dev/buttons/review-in-cubic-dark.svg"><source media="(prefers-color-scheme: light)" srcset="https://www.cubic.dev/buttons/review-in-cubic-light.svg"><img alt="Review in cubic" src="https://www.cubic.dev/buttons/review-in-cubic-dark.svg"></picture></a> <!-- End of auto-generated description by cubic. -->  
  **Post-Mortem & Fix Analysis**:
  > [vc]: #/3NHlotoIAyb8bn5AD6PgdtmKzzDqV4HiXe+FgqiBkg=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJvcGVuc3RhdHVzLXdlYiIsInByb2plY3RJZCI6InByal94NFlBcWZvaWhzNGdaOW5lRWVrTVZ4OU5scHpaIiwidjAiOmZhbHNlLCJyb290RGlyZWN0b3J5IjoiYXBwcy93ZWIiLCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vb3Blbi1zdGF0dXMvb3BlbnN0YXR1cy13ZWIvRWpEZkxtaXhXcEVEOGpXRkc4clVNZ2RjRHlzaCIsInByZXZpZXdVcmwiOiJvcGVuc3RhdHVzLXdlYi1naXQtcHVzaC15enN3c3Btd3F6bngtb3Blbi1zdGF0dXMudmVyY2VsLmFwcCIsIm5leHRDb21taXRTdGF0dXMiOiJERVBMT1lFRCIsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiJvcGVuc3RhdHVzLXdlYi1naXQtcHVzaC15enN3c3Btd3F6bngtb3Blbi1zdGF0dXMudmVyY2VsLmFwcCJ9fSx7Im5hbWUiOiJvcGVuc3RhdHVzLWRhc2hib2FyZCIsInByb2plY3RJZCI6InByal9Uc2F6YUhPN2NGcXRCS0dBa1JCTjdtMTgxTUpYIiwidjAiOmZhbHNlLCJyb290RGlyZWN0b3J5IjoiYXBwcy9kYXNoYm9hcmQiLCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vb3Blbi1zdGF0dXMvb3BlbnN0YXR1cy1kYXNoYm9hcmQvQ29SVGp2MkpUQnE0TGQzaXVpb1puS1dnU1haQyIsInByZXZpZXdVcmwi
  > @claude review this 
  > **Claude finished @thibaultleouay's task in 25s** —— [View job](https://github.com/openstatusHQ/openstatus/actions/runs/37302158286)  --- ### Review of #2847 "stripe: improve webhook"  I read the diff and the surrounding callers. I didn't run the test suite.  **Overall:** The two changes are sound and tested. Custom-deal prices no longer make the webhook throw, and the trial-ending email failure now reaches Stripe for redelivery. I have a few concerns, none of them blocking.  - [x] Read the diff - [x] Check callers of the changed functions - [x] Post the review  #### 1. Custom prices: plan syncs, limits are kept - `buildLimitsFromSubscription` now returns `customPriceIds` instead of throwing. `syncedLimits` returns `undefined` when any custom price is present. `UpdateWorkspacePlanInput.limits` is now optional, and `updateWorkspacePlan` skips the column when it is `undefined`. This hangs together, and the new webhook test covers it. - **Addons are lost on mixed subscriptions.** If a sub

- **Issue #2845** (2026-10-05): **chore: dashboard mobile form layout improvements**
  *Symptoms*:   <!-- This is an auto-generated description by cubic. --> <a href="https://cubic.dev/pr/openstatusHQ/openstatus/pull/2845?utm_source=github" target="_blank" rel="noopener noreferrer" data-no-image-dialog="true"><picture><source media="(prefers-color-scheme: dark)" srcset="https://www.cubic.dev/buttons/review-in-cubic-dark.svg"><source media="(prefers-color-scheme: light)" srcset="https://www.cubic.dev/buttons/review-in-cubic-light.svg"><img alt="Review in cubic" src="https://www.cubic.dev/buttons/review-in-cubic-dark.svg"></picture></a> <!-- End of auto-generated description by cubic. -->  
  **Post-Mortem & Fix Analysis**:
  > [vc]: #Zonvtl5GXth4hv3vENZaRuRJVh4ztSeqETnOkEGp1aI=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJvcGVuc3RhdHVzLXdlYiIsInByb2plY3RJZCI6InByal94NFlBcWZvaWhzNGdaOW5lRWVrTVZ4OU5scHpaIiwicm9vdERpcmVjdG9yeSI6ImFwcHMvd2ViIiwibGl2ZUZlZWRiYWNrIjp7InJlc29sdmVkIjowLCJ1bnJlc29sdmVkIjowLCJ0b3RhbCI6MCwibGluayI6IiJ9LCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vb3Blbi1zdGF0dXMvb3BlbnN0YXR1cy13ZWIvRHZ3aWVtY1hrTHNBNmFiQjZreFZKWm85aXRRMSIsInByZXZpZXdVcmwiOiIiLCJuZXh0Q29tbWl0U3RhdHVzIjoiU0tJUFBFRCJ9LHsibmFtZSI6Im9wZW5zdGF0dXMtZGFzaGJvYXJkIiwicHJvamVjdElkIjoicHJqX1RzYXphSE83Y0ZxdEJLR0FrUkJON20xODFNSlgiLCJ2MCI6ZmFsc2UsInJvb3REaXJlY3RvcnkiOiJhcHBzL2Rhc2hib2FyZCIsImluc3BlY3RvclVybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS9vcGVuLXN0YXR1cy9vcGVuc3RhdHVzLWRhc2hib2FyZC9GRHdVOG9QZlJ1cmtoWUR2NFdOYUhZOHRTU1czIiwicHJldmlld1VybCI6Im9wZW5zdGF0dXMtZGFzaGJvYXJkLWdpdC1jaG9yZS1kYXNoYm9hcmQtbW9iLWJkMDRmNS1vcGVuLXN0YXR1cy52ZXJjZWwuYXBwIiwibmV4dENvbW1pdFN0YXR1cyI6IkRFUExPWUVEIiwibGl2ZUZlZWRiYWNrIjp7InJlc29s
  > @claude review
  > **Claude finished @mxkaske's task in 28s** —— [View job](https://github.com/openstatusHQ/openstatus/actions/runs/37339297301)  --- ### Review of #2845: dashboard mobile form layout improvements  I read the full diff and spot-checked the helper components it touches. I did not run the app or take screenshots, so none of the layout claims below are visually verified. No blocking issues.  **What it does** - Standardizes form cards to a 3-column grid from `sm`, with inputs spanning 2 columns, so fields stop stretching full width on desktop. - Stacks the component buttons on phones. - Reworks the component and group rows into an `auto + minmax(0,1fr)` grid so the drag handle spans both rows on mobile. - Reflows the status report composer for narrow screens. - Removes the `Add` icons from "create" buttons.  **Checked and fine** - `ComponentListItem`, `ComponentListName` and `ComponentListActions` all merge `className` through `cn`, so the new overrides apply. - `ComponentListAdd` takes a `cl

- **Issue #2841** (2026-10-05): **feat: incident api**
  *Symptoms*: Exposes managed incidents on the ConnectRPC API as `openstatus.incident.v1.IncidentService`.  **Merge after #2809** (incident launch / flag removal). Until then the new RPCs return `permission_denied` for workspaces outside the `incident-management` allowlist. Server tests enable the feature with `OPENSTATUS_FEATURES` in `.env.test`.  ## What's in it  - **13 RPCs:** `DeclareIncident`, `GetIncident` (with timeline), `ListIncidents` (statuses + `closed` filter, `total_size`), `UpdateIncident`, `SetIncidentStatus`, `AddIncidentNote`, `LinkStatusReport`, `UnlinkStatusReport`, `CloseIncident`, `DeleteIncident`, `GetPostmortem`, `UpdatePostmortem`, `ApprovePostmortem`. - **Status reports:** `CreateStatusReportRequest.incident_id` links in the same transaction, and `StatusReport`/`StatusReportSummary` return `incident_id`. - **Same side effects as the dashboard:** the after-verb effects (commander email, Slack channel open, announce and archive) moved into `packages/services/src/incident/effects.ts`. tRPC, Slack and RPC all call it. - **Docs:** SDK page, reference enums, changelog.  ## Behavior changes to review  - **Wire change:** `ConflictError` now maps to `failed_precondition` instead of `invalid_argument` on **every** RPC service (status-report, maintenance, page…). It's called out in the changelog. - **tRPC:** the commander email is now sent after the response (`after()`) instead of before it. - **Approval announcement:** approving a postmortem without closing is now announced
  **Post-Mortem & Fix Analysis**:
  > [vc]: #p/dYV4eiboUtbZ70PpSw6hpn/Mm+OrLEkboLOy2Cc8Y=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJvcGVuc3RhdHVzLXdlYiIsInByb2plY3RJZCI6InByal94NFlBcWZvaWhzNGdaOW5lRWVrTVZ4OU5scHpaIiwidjAiOmZhbHNlLCJyb290RGlyZWN0b3J5IjoiYXBwcy93ZWIiLCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vb3Blbi1zdGF0dXMvb3BlbnN0YXR1cy13ZWIvNXhrcVdvQkhZYTdqSmdhRlY3Q3Nod1lZWDluRyIsInByZXZpZXdVcmwiOiJvcGVuc3RhdHVzLXdlYi1naXQtaW5jaWRlbnQtYXBpLW9wZW4tc3RhdHVzLnZlcmNlbC5hcHAiLCJuZXh0Q29tbWl0U3RhdHVzIjoiREVQTE9ZRUQiLCJsaXZlRmVlZGJhY2siOnsicmVzb2x2ZWQiOjAsInVucmVzb2x2ZWQiOjAsInRvdGFsIjowLCJsaW5rIjoib3BlbnN0YXR1cy13ZWItZ2l0LWluY2lkZW50LWFwaS1vcGVuLXN0YXR1cy52ZXJjZWwuYXBwIn19LHsibmFtZSI6Im9wZW5zdGF0dXMtZGFzaGJvYXJkIiwicHJvamVjdElkIjoicHJqX1RzYXphSE83Y0ZxdEJLR0FrUkJON20xODFNSlgiLCJ2MCI6ZmFsc2UsInJvb3REaXJlY3RvcnkiOiJhcHBzL2Rhc2hib2FyZCIsImluc3BlY3RvclVybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS9vcGVuLXN0YXR1cy9vcGVuc3RhdHVzLWRhc2hib2FyZC9DaXFORnVpenlGZ1RoeGhhZU03dnFCNU5GZXZ3IiwicHJldmlld1VybCI6Im9wZW5zdGF0

- **Issue #2840** (2026-10-05): **fix: whatsapp notification test**
  *Symptoms*:   <!-- This is an auto-generated description by cubic. --> <a href="https://cubic.dev/pr/openstatusHQ/openstatus/pull/2840?utm_source=github" target="_blank" rel="noopener noreferrer" data-no-image-dialog="true"><picture><source media="(prefers-color-scheme: dark)" srcset="https://www.cubic.dev/buttons/review-in-cubic-dark.svg"><source media="(prefers-color-scheme: light)" srcset="https://www.cubic.dev/buttons/review-in-cubic-light.svg"><img alt="Review in cubic" src="https://www.cubic.dev/buttons/review-in-cubic-dark.svg"></picture></a> <!-- End of auto-generated description by cubic. -->  
  **Post-Mortem & Fix Analysis**:
  > [vc]: #AW+o2nBUrPX41tZZVOaziApQkFDYrn5k0DqZ6FlVGlY=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJvcGVuc3RhdHVzLXdlYiIsInByb2plY3RJZCI6InByal94NFlBcWZvaWhzNGdaOW5lRWVrTVZ4OU5scHpaIiwidjAiOmZhbHNlLCJyb290RGlyZWN0b3J5IjoiYXBwcy93ZWIiLCJsaXZlRmVlZGJhY2siOnsicmVzb2x2ZWQiOjAsInVucmVzb2x2ZWQiOjAsInRvdGFsIjowLCJsaW5rIjoiIn0sImluc3BlY3RvclVybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS9vcGVuLXN0YXR1cy9vcGVuc3RhdHVzLXdlYi84aXF3NVp2TVJSQ2loU2FjWGtrR3hZTXVTODJRIiwicHJldmlld1VybCI6IiIsIm5leHRDb21taXRTdGF0dXMiOiJTS0lQUEVEIn0seyJuYW1lIjoib3BlbnN0YXR1cy1kYXNoYm9hcmQiLCJwcm9qZWN0SWQiOiJwcmpfVHNhemFITzdjRnF0QktHQWtSQk43bTE4MU1KWCIsInYwIjpmYWxzZSwicm9vdERpcmVjdG9yeSI6ImFwcHMvZGFzaGJvYXJkIiwibGl2ZUZlZWRiYWNrIjp7InJlc29sdmVkIjowLCJ1bnJlc29sdmVkIjowLCJ0b3RhbCI6MCwibGluayI6Im9wZW5zdGF0dXMtZGFzaGJvYXJkLWdpdC1maXgtd2hhdHNhcHAtbm90aWZpLWMyMmRlOC1vcGVuLXN0YXR1cy52ZXJjZWwuYXBwIn0sImluc3BlY3RvclVybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS9vcGVuLXN0YXR1cy9vcGVuc3RhdHVzLWRhc2hib2FyZC85RGdGMWUzRFRFSGhvN3RHWHF2Z0xE
  > @claude review this 
  > **Claude finished @thibaultleouay's task in 15s** —— [View job](https://github.com/openstatusHQ/openstatus/actions/runs/37284978593)  --- ### Review of PR #2840: WhatsApp notification form hint  - [x] Read the diff - [x] Check env handling and link markup  **Summary:** This adds a hint to the WhatsApp form. It tells users to message the sender number first so WhatsApp doesn't treat the notifications as spam. The number comes from `NEXT_PUBLIC_WHATSAPP_PHONE_NUMBER` and the hint is hidden when the variable is unset. The change is small and reads cleanly. I found no blocking issues, only the points below.  **Points to consider**  1. **Turbo env hash (minor).** `turbo.json` lists `NEXT_PUBLIC_*` vars explicitly, for example `NEXT_PUBLIC_OPENPANEL_CLIENT_ID` at line 37. `NEXT_PUBLIC_WHATSAPP_PHONE_NUMBER` is inlined at build time, so if it is not in that list, changing it may not invalidate the Turbo cache. That could leave a stale value in cached builds. I only checked the `NEXT_PUBLIC_*`

- **Issue #2838** (2026-10-02): **fix: resolve pinned slack message created by**
  *Symptoms*:   <!-- This is an auto-generated description by cubic. --> <a href="https://cubic.dev/pr/openstatusHQ/openstatus/pull/2838?utm_source=github" target="_blank" rel="noopener noreferrer" data-no-image-dialog="true"><picture><source media="(prefers-color-scheme: dark)" srcset="https://www.cubic.dev/buttons/review-in-cubic-dark.svg"><source media="(prefers-color-scheme: light)" srcset="https://www.cubic.dev/buttons/review-in-cubic-light.svg"><img alt="Review in cubic" src="https://www.cubic.dev/buttons/review-in-cubic-dark.svg"></picture></a> <!-- End of auto-generated description by cubic. -->  
  **Post-Mortem & Fix Analysis**:
  > [vc]: #Pq7o3JrxoxLxn33WYGqAWJ/kpIsxnl3QY+P7I0wrRh0=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJvcGVuc3RhdHVzLXdlYiIsInByb2plY3RJZCI6InByal94NFlBcWZvaWhzNGdaOW5lRWVrTVZ4OU5scHpaIiwicm9vdERpcmVjdG9yeSI6ImFwcHMvd2ViIiwiaW5zcGVjdG9yVXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL29wZW4tc3RhdHVzL29wZW5zdGF0dXMtd2ViLzUxTkVCQ2t1ZEI1YUZtUzJBVGU1ZEx6WXhZQlgiLCJwcmV2aWV3VXJsIjoiIiwibmV4dENvbW1pdFN0YXR1cyI6IlNLSVBQRUQiLCJsaXZlRmVlZGJhY2siOnsicmVzb2x2ZWQiOjAsInVucmVzb2x2ZWQiOjAsInRvdGFsIjowLCJsaW5rIjoiIn19LHsibmFtZSI6Im9wZW5zdGF0dXMtZGFzaGJvYXJkIiwicHJvamVjdElkIjoicHJqX1RzYXphSE83Y0ZxdEJLR0FrUkJON20xODFNSlgiLCJyb290RGlyZWN0b3J5IjoiYXBwcy9kYXNoYm9hcmQiLCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vb3Blbi1zdGF0dXMvb3BlbnN0YXR1cy1kYXNoYm9hcmQvNmJDNHVTenVmOFVhdzI3VmRIR05yNUpqWnprViIsInByZXZpZXdVcmwiOiIiLCJuZXh0Q29tbWl0U3RhdHVzIjoiU0tJUFBFRCIsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiIifX0seyJuYW1lIjoib3BlbnN0YXR1cy1zdGF0dXMtcGFnZSIsInByb2plY3RJ
  > @claude review
  > **Claude finished @mxkaske's task in 25s** —— [View job](https://github.com/openstatusHQ/openstatus/actions/runs/36982396096)  --- ### Review of #2838: attribute pinned Slack notes to the message author  - [x] Read the diff - [x] Checked callers of `addIncidentNote` and `resolveSlackMember`  **Overall:** This looks good to merge. The change is small and focused, and the tests cover the main paths. I didn't run the test suite.  **What it does** - `handlePinReaction` resolves the Slack author of the pinned message to an openstatus member. - It passes that member's id as `createdBy` to `addIncidentNote`. - Bot messages, unlinked authors and self-pins fall back to the actor, because `author ?? undefined` leaves `createdBy` unset and `appendIncidentEvent` uses `tryGetActorUserId`.  **Why it's safe** - `addIncidentNote` runs `assertMember` on `createdBy`, so a note can't be attributed to someone outside the workspace. There's a test for this. - The agent/MCP `add_incident_note` tool defines 

- **Issue #2837** (2026-10-02): **chore: status-report timeline changelog**
  *Symptoms*:   <!-- This is an auto-generated description by cubic. --> <a href="https://cubic.dev/pr/openstatusHQ/openstatus/pull/2837?utm_source=github" target="_blank" rel="noopener noreferrer" data-no-image-dialog="true"><picture><source media="(prefers-color-scheme: dark)" srcset="https://www.cubic.dev/buttons/review-in-cubic-dark.svg"><source media="(prefers-color-scheme: light)" srcset="https://www.cubic.dev/buttons/review-in-cubic-light.svg"><img alt="Review in cubic" src="https://www.cubic.dev/buttons/review-in-cubic-dark.svg"></picture></a> <!-- End of auto-generated description by cubic. -->  
  **Post-Mortem & Fix Analysis**:
  > [vc]: #1UGauN18dykLI5CS29MIUXy5BDFMihbLv2jukHuvR6Y=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJvcGVuc3RhdHVzLXdlYiIsInByb2plY3RJZCI6InByal94NFlBcWZvaWhzNGdaOW5lRWVrTVZ4OU5scHpaIiwidjAiOmZhbHNlLCJyb290RGlyZWN0b3J5IjoiYXBwcy93ZWIiLCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vb3Blbi1zdGF0dXMvb3BlbnN0YXR1cy13ZWIvM2pyQlNuTXJ4MkQ2SGl4aXVia1piSmdjUHlOOCIsInByZXZpZXdVcmwiOiJvcGVuc3RhdHVzLXdlYi1naXQtY2hvcmUtc3RhdHVzLXJlcG9ydC10aW1lbC00ZjVkNzQtb3Blbi1zdGF0dXMudmVyY2VsLmFwcCIsIm5leHRDb21taXRTdGF0dXMiOiJERVBMT1lFRCIsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiJvcGVuc3RhdHVzLXdlYi1naXQtY2hvcmUtc3RhdHVzLXJlcG9ydC10aW1lbC00ZjVkNzQtb3Blbi1zdGF0dXMudmVyY2VsLmFwcCJ9fSx7Im5hbWUiOiJvcGVuc3RhdHVzLWRhc2hib2FyZCIsInByb2plY3RJZCI6InByal9Uc2F6YUhPN2NGcXRCS0dBa1JCTjdtMTgxTUpYIiwidjAiOmZhbHNlLCJyb290RGlyZWN0b3J5IjoiYXBwcy9kYXNoYm9hcmQiLCJsaXZlRmVlZGJhY2siOnsicmVzb2x2ZWQiOjAsInVucmVzb2x2ZWQiOjAsInRvdGFsIjowLCJsaW5rIjoiIn0sImluc3BlY3RvclVybCI6

### D4: Resource Lifecycle & Leak Defenses
- Memory allocation, socket lifecycle, and handle cleanup observed from bug fixes and PR deltas.

### D5: Boundary Deserialization & Encoding
- Schema deserialization, payload validation, and untrusted input guards.

### D6: Cross-Platform & Runtime Gotchas
- Platform variance, OS-specific gotchas, and environment discrepancies detected in issue reports.

### D7: Build, CI/CD, Deployment & Tooling
- Toolchain requirements, dependencies, and packaging specs verified against remote manifests.

### D8: Forensic Bug Fixes & Real Production Code Patches
Observed empirical fixes and code patches:

### Incident Patch 1: `58808205` (2026-10-05)
**Commit Message**: fix: whatsapp notification test (#2840)

**File**: `apps/dashboard/.env.example` (modified, +3/-0)
```diff
@@ -73,6 +73,9 @@ WORKOS_WEBHOOK_SECRET=
 
 PAGERDUTY_APP_ID=
 
+# WhatsApp sender number shown in the notification form hint (e.g. +1 754 255 8482)
+NEXT_PUBLIC_WHATSAPP_PHONE_NUMBER=
+
 SLACK_SUPPORT_WEBHOOK_URL=
 
 WORKSPACES_HIDE_URL=
```

**File**: `apps/dashboard/src/components/forms/notifications/form-whatsapp.tsx` (modified, +25/-0)
```diff
@@ -15,6 +15,7 @@ import { Input } from "@openstatus/ui/components/ui/input";
 import { cn } from "@openstatus/ui/lib/utils";
 import { useMutation } from "@tanstack/react-query";
 import { isTRPCClientError } from "@trpc/client";
+import Link from "next/link";
 import React, { useTransition } from "react";
 import { useForm } from "react-hook-form";
 import { toast } from "sonner";
@@ -48,6 +49,8 @@ export function FormWhatsApp({
   onSubmit: (values: FormValues) => Promise<void>;
   monitors: { id: number; name: string }[];
 }) {
+  // Sender number shown in the anti-spam hint; unset on self-hosted installs.
+  const senderPhoneNumber = process.env.NEXT_PUBLIC_WHATSAPP_PHONE_NUMBER;
   const form = useForm<FormValues>({
     resolver: zodResolver(schema),
     defaultValues: defaultValues ?? {
@@ -165,6 +168,28 @@ export function FormWhatsApp({
                 <FormMessage />
                 <FormDescription>
                   Enter the phone number to send notifications to.
+                  {senderPhoneNumber ? (
+                    <>
+                      {" "}
+                      Not receiving messages? Send a message to our number{" "}
+                      <Link
+                        href={`https://wa.me/${senderPhoneNumber.replace(/\D/g, "")}`}
+                        rel="noreferrer"
+                        target="_blank"
+                      >
+                        {senderPhoneNumber}
+                      </Link>{" "}
+                      first so WhatsApp knows it&apos;s not spam.{" "}
+                      <Link
+                        href="https://www.openstatus.dev/docs/reference/notification/#whatsapp"
+                        rel="noreferrer"
+                        target="_blank"
+                      >
+                        Read more
+                      </Link>
+                      .
+                    </>
+                  ) : null}
                 </FormDescription>
               </FormItem>
             )}
```

---

### Incident Patch 2: `25b3d65f` (2026-10-03)
**Commit Message**: feat(ui): add withCheckbox support to DataTableSkeleton (#2785)

* feat(ui): add withCheckbox support to DataTableSkeleton

* refactor(ui): remove withCheckbox and obsolete TODO from DataTableSkeleton

- Remove unused withCheckbox property from DataTableSkeleton

- Remove obsolete TODO comment regarding checkbox skeleton

**File**: `apps/dashboard/src/components/ui/data-table/data-table-skeleton.tsx` (modified, +0/-2)
```diff
@@ -16,8 +16,6 @@ interface DataTableSkeletonProps {
   rows?: number;
 }
 
-// TODO: add checkbox skeleton (for MonitorTable e.g.)
-
 export function DataTableSkeleton({ rows = 3 }: DataTableSkeletonProps) {
   return (
     <Table>
```

**File**: `apps/status-page/src/components/ui/data-table/data-table-skeleton.tsx` (modified, +1/-3)
```diff
@@ -16,8 +16,6 @@ interface DataTableSkeletonProps {
   rows?: number;
 }
 
-// TODO: add checkbox skeleton (for MonitorTable e.g.)
-
 export function DataTableSkeleton({ rows = 3 }: DataTableSkeletonProps) {
   return (
     <Table>
@@ -39,7 +37,7 @@ export function DataTableSkeleton({ rows = 3 }: DataTableSkeletonProps) {
         </TableRow>
       </TableHeader>
       <TableBody>
-        {new Array(rows).fill(0).map((_, i) => (
+        {Array.from({ length: rows }).map((_, i) => (
           <TableRow key={i} className="hover:bg-transparent">
             <TableCell>
               <Skeleton className="my-1.5 h-4 w-full max-w-40" />
```

---

### Incident Patch 3: `23bac253` (2026-10-02)
**Commit Message**: fix: resolve pinned slack message created by (#2838)

* fix: resolve pinned slack message

* fix: format

* wip:

* fix:

**File**: `apps/server/src/routes/slack/handler.test.ts` (modified, +141/-1)
```diff
@@ -5,8 +5,15 @@ import {
   incident,
   incidentEvent,
   integration,
+  slackUser,
+  user,
+  usersToWorkspaces,
 } from "@openstatus/db/src/schema";
-import { createTestWorkspace } from "@openstatus/db/src/test/factories";
+import {
+  addUserToWorkspace,
+  createTestWorkspace,
+  createUser,
+} from "@openstatus/db/src/test/factories";
 import {
   afterEach,
   beforeEach,
@@ -2213,6 +2220,139 @@ describe("incident channel events", () => {
     );
   });
 
+  test("the note belongs to the author, not the pinner", async () => {
+    const author = await createUser();
+    await addUserToWorkspace(author.id, 1, "member");
+    const authorSlackId = `U_AUTHOR_${crypto.randomUUID()}`;
+    slackTestState.usersInfoImpl = (args) =>
+      Promise.resolve({
+        ok: true,
+        user: {
+          profile: {
+            email:
+              args.user === authorSlackId
+                ? author.email
+                : "ping@openstatus.dev",
+          },
+        },
+      });
+    slackTestState.historyImpl = () =>
+      Promise.resolve({
+        messages: [
+          { ts: "508.1", text: "I rolled it back", user: authorSlackId },
+        ],
+      });
+    try {
+      await pin("508.1");
+      await waitForCall("reactions.add");
+      const rows = await notes();
+      expect(rows).toHaveLength(1);
+      expect(rows[0].createdBy).toBe(author.id);
+    } finally {
+      // The note references the author; drop it before the user.
+      await db
+        .delete(incidentEvent)
+        .where(eq(incidentEvent.incidentId, incidentId));
+      await db
+        .delete(slackUser)
+        .where(eq(slackUser.slackUserId, authorSlackId));
+      await db
+        .delete(usersToWorkspaces)
+        .where(eq(usersToWorkspaces.userId, author.id));
+      await db.delete(user).where(eq(user.id, author.id));
+    }
+  });
+
+  test("a bot message is attributed to the pinner without a lookup", async () => {
+    // Apps with a bot user carry both `bot_id` and `user`.
+    slackTestState.historyImpl = () =>
+      Promise.resolve({
+        messages: [
+          {
+            ts: "509.1",
+            text: "[FIRING] api 5xx",
+            bot_id: "B1",
+            user: "U_BOT",
+          },
+        ],
+      });
+    await pin("509.1");
+    await waitForCall("reactions.add");
+    const rows = await notes();
+    expect(rows).toHaveLength(1);
+    const [pinner] = await db
+      .select({ id: user.id })
+      .from(user)
+      .where(eq(user.email, "ping@openstatus.dev"));
+    expect(rows[0].createdBy).toBe(pinner.id);
+    expect(
+      slackTestState.calls.some(
+        (m) => m.method === "users.info" && m.args.user === "U_BOT",
+      ),
+    ).toBe(false);
+  });
+
+  test("a failed author lookup releases the pin for a retry", async () => {
+    const author = await createUser();
+    await addUserToWorkspace(author.id, 1, "member");
+    const authorSlackId = `U_AUTHOR_${crypto.randomUUID()}`;
+    let flaky = true;
+    slackTestState.usersInfoImpl = (args) => {
+      if (args.user !== authorSlackId) {
+        return Promise.resolve({
+          ok: true,
+          user: { profile: { email: "ping@openstatus.dev" } },
+        });
+      }
+      if (flaky) {
+        const err = new Error("An API error occurred: ratelimited");
+        Object.assign(err, { data: { ok: false, error: "ratelimited" } });
+        return Promise.reject(err);
+      }
+      return Promise.resolve({
+        ok: true,
+        user: { profile: { email: author.email } },
+      });
+    };
+    slackTestState.historyImpl = () =>
+      Promise.resolve({
+        messages: [{ ts: "510.1", text: "flaky lookup", user: authorSlackId }],
+      });
+    try {
+      await pin("510.1");
+      await settleBackgroundTasks();
+      expect(await notes()).toHaveLength(0);
+      expect(await waitForCall("reactions.add", 100)).toBeUndefined();
+      const notice = await waitForCall("postEphemeral");
+      expect(notice?.args.text).toContain("Pin it again");
+
+      // A second failure stays quiet; the pinner was already told.
+      await pin("510.1");
+      await settleBackgroundTasks();
+      expect(
+        slackTestState.calls.filter((c) => c.method === "postEphemeral"),
+      ).toHaveLength(1);
+
+      flaky = false;
+      await pin("510.1");
+      await waitForCall("reactions.add");
+      const rows = await notes();
+      expect(rows).toHaveLength(1);
+      expect(rows[0].createdBy).toBe(author.id);
+    } finally {
+      await db
+        .delete(incidentEvent)
+        .where(eq(incidentEvent.incidentId, incidentId));
+      await db
+        .delete(slackUser)
+        .where(eq(slackUser.slackUserId, authorSlackId));
+      await db
+        .delete(usersToWorkspaces)
+        .where(eq(usersToWorkspaces.userId, author.id));
+      await db.delete(user).where(eq(user.id, author.id));
+    }
+  });
+
   test("a message with only attachments is noted from their fallback", async () =>
```

**File**: `apps/server/src/routes/slack/incident-events.ts` (modified, +54/-5)
```diff
@@ -18,7 +18,10 @@ import {
   requireSlackMember,
   slackAgentAllowed,
 } from "./require-slack-member";
-import { resolveSlackMentionNames } from "./resolve-slack-user";
+import {
+  resolveSlackMember,
+  resolveSlackMentionNames,
+} from "./resolve-slack-user";
 import {
   collectMentions,
   mentionLabelsFromText,
@@ -35,11 +38,15 @@ type SlackMessage = {
   ts?: string;
   text?: string;
   user?: string;
+  bot_id?: string;
+  subtype?: string;
   blocks?: unknown[];
   attachments?: { text?: string; fallback?: string }[];
 };
 
 const NOTHING_TO_COPY = "Nothing to copy from that message.";
+const PIN_FAILED =
+  "Couldn't copy that message to the timeline. Pin it again to retry.";
 const VERB_LAG_MS = 60_000;
 
 /**
@@ -215,10 +222,31 @@ export async function handlePinReaction(args: {
         );
       return;
     }
-    const permalink = await slack.chat
-      .getPermalink({ channel, message_ts: ts })
-      .then((res) => res.permalink)
-      .catch(() => undefined);
+    // The note belongs to whoever said it; bots and unlinked authors fall
+    // back to the pinner. A lookup hiccup throws so the claim is released and
+    // Slack retries, rather than pinning the wrong name forever.
+    const authorSlackId =
+      message?.user &&
+      message.user !== slackUserId &&
+      !message.bot_id &&
+      message.subtype !== "bot_message"
+        ? message.user
+        : null;
+    const [permalink, author] = await Promise.all([
+      slack.chat
+        .getPermalink({ channel, message_ts: ts })
+        .then((res) => res.permalink)
+        .catch(() => undefined),
+      authorSlackId
+        ? resolveSlackMember({
+            workspace: resolved.workspace,
+            teamId,
+            slackUserId: authorSlackId,
+            slack,
+            strict: true,
+          })
+        : null,
+    ]);
 
     const ctx: ServiceContext = { workspace: resolved.workspace, actor };
     await addIncidentNote({
@@ -227,11 +255,32 @@ export async function handlePinReaction(args: {
         id: bound.id,
         message: permalink ? `${body}\n\n[From Slack](${permalink})` : body,
         createdAt: messageDate(ts),
+        createdBy: author ?? undefined,
       },
     });
     trackSlackIncident(ctx, "note", { via: "reaction" });
   } catch (err) {
     await redis.del(claim).catch(() => undefined);
+    // Slack retries the event, but a lost pin should not go unnoticed if it
+    // keeps failing; one notice per message is enough.
+    const once = await redis
+      .set(`slack:pinfail:${channel}:${ts}`, "1", {
+        nx: true,
+        ex: 24 * 60 * 60,
+      })
+      .catch(() => null);
+    if (once !== null) {
+      await slack.chat
+        .postEphemeral({
+          channel,
+          user: slackUserId,
+          thread_ts: ts,
+          text: PIN_FAILED,
+        })
+        .catch((error) =>
+          logger.warn("slack failed to report a lost pin", { error }),
+        );
+    }
     throw err;
   }
   await slack.reactions
```

**File**: `apps/server/src/routes/slack/resolve-slack-user.ts` (modified, +12/-0)
```diff
@@ -21,11 +21,18 @@ const logger = getLogger(["api-server", "slack", "resolve-user"]);
  * in a pinned message can create the mapping; it is the same rule applied
  * when they act themselves.
  */
+function isUserNotFound(err: unknown): boolean {
+  const code = (err as { data?: { error?: string } })?.data?.error;
+  return code === "user_not_found" || code === "users_not_found";
+}
+
 async function lookupSlackMember(args: {
   workspace: Workspace;
   teamId: string;
   slackUserId: string;
   slack: WebClient;
+  /** Rethrow a failed lookup instead of answering "unlinked". */
+  strict?: boolean;
 }): Promise<{ userId: number | null; profileName: string | null }> {
   const { workspace, teamId, slackUserId, slack } = args;
   if (!teamId || !slackUserId) return { userId: null, profileName: null };
@@ -58,6 +65,9 @@ async function lookupSlackMember(args: {
     });
     return { userId, profileName };
   } catch (err) {
+    // A user Slack no longer knows is unlinked for good; anything else
+    // (rate limit, DB) is a hiccup the caller may want to retry.
+    if (args.strict && !isUserNotFound(err)) throw err;
     logger.warn("slack user resolution failed", {
       workspaceId: workspace.id,
       teamId,
@@ -70,12 +80,14 @@ async function lookupSlackMember(args: {
 /**
  * The openstatus member linked to a Slack user, or `null`. A missing link is
  * created on the spot when the Slack profile email matches exactly one member.
+ * With `strict`, a failed lookup throws instead of passing for "unlinked".
  */
 export async function resolveSlackMember(args: {
   workspace: Workspace;
   teamId: string;
   slackUserId: string;
   slack: WebClient;
+  strict?: boolean;
 }): Promise<number | null> {
   return (await lookupSlackMember(args)).userId;
 }
```

**File**: `packages/api/src/router/incident.ts` (modified, +2/-1)
```diff
@@ -284,7 +284,8 @@ export const incidentRouter = createTRPCRouter({
 
   addNote: protectedProcedure
     .meta({ track: Events.AddManagedIncidentNote })
-    .input(AddIncidentNoteInput)
+    // `createdBy` is for trusted callers copying a note in (Slack pins).
+    .input(AddIncidentNoteInput.omit({ createdBy: true }))
     .mutation(async ({ ctx, input }) => {
       try {
         return await addIncidentNote({ ctx: toServiceCtx(ctx), input });
```

**File**: `packages/services/src/incident/__tests__/incident.test.ts` (modified, +38/-0)
```diff
@@ -496,6 +496,44 @@ describe("addIncidentNote", () => {
     });
   });
 
+  test("createdBy attributes the note to another member, actor stays audited", async () => {
+    await withTestTransaction(async (tx) => {
+      const row = await declare(tx);
+      const note = await addIncidentNote({
+        ctx: as(memberId, tx),
+        input: { id: row.id, message: "said by admin", createdBy: adminId },
+      });
+      expect(note.createdBy).toBe(adminId);
+      const [audit] = await tx
+        .select()
+        .from(auditLog)
+        .where(
+          and(
+            eq(auditLog.entityType, "incident_event"),
+            eq(auditLog.entityId, String(note.id)),
+          ),
+        );
+      expect(audit?.actorUserId).toBe(memberId);
+      const self = await addIncidentNote({
+        ctx: as(memberId, tx),
+        input: { id: row.id, message: "mine", createdBy: null },
+      });
+      expect(self.createdBy).toBe(memberId);
+    });
+  });
+
+  test("rejects a createdBy outside the workspace", async () => {
+    await withTestTransaction(async (tx) => {
+      const row = await declare(tx);
+      await expect(
+        addIncidentNote({
+          ctx: as(memberId, tx),
+          input: { id: row.id, message: "spoofed", createdBy: outsiderId },
+        }),
+      ).rejects.toThrow(ValidationError);
+    });
+  });
+
   test("a closed incident takes no notes", async () => {
     await withTestTransaction(async (tx) => {
       const row = await createIncident(
```

**File**: `packages/services/src/incident/add-note.ts` (modified, +5/-0)
```diff
@@ -4,6 +4,7 @@ import { requireScope } from "../auth";
 import { type ServiceContext, withTransaction } from "../context";
 import {
   appendIncidentEvent,
+  assertMember,
   assertNotClosed,
   getIncidentInWorkspace,
   requireIncidentFeature,
@@ -28,11 +29,15 @@ export async function addIncidentNote(args: {
       input.id,
     );
     assertNotClosed(existing);
+    if (input.createdBy != null) {
+      await assertMember(tx, ctx.workspace.id, input.createdBy);
+    }
     return appendIncidentEvent(tx, ctx, {
       incidentId: existing.id,
       type: "note",
       message: input.message,
       createdAt: input.createdAt ?? undefined,
+      createdBy: input.createdBy,
     });
   });
 }
```

**File**: `packages/services/src/incident/internal.ts` (modified, +2/-1)
```diff
@@ -79,6 +79,7 @@ export async function appendIncidentEvent(
     type: IncidentEventType;
     message?: string | null;
     createdAt?: Date;
+    createdBy?: number | null;
   },
 ): Promise<IncidentEvent> {
   const event = await tx
@@ -87,7 +88,7 @@ export async function appendIncidentEvent(
       incidentId: args.incidentId,
       type: args.type,
       message: args.message ?? null,
-      createdBy: tryGetActorUserId(ctx.actor),
+      createdBy: args.createdBy ?? tryGetActorUserId(ctx.actor),
       createdAt: args.createdAt ?? new Date(),
     })
     .returning()
```

**File**: `packages/services/src/incident/schemas.ts` (modified, +5/-0)
```diff
@@ -66,6 +66,11 @@ export const AddIncidentNoteInput = z.object({
         "createdAt must be within the last 30 days and at most a minute ahead",
     })
     .nullish(),
+  // The member who wrote the note when someone else copies it in (a pinned
+  // Slack message). The actor stays the one who performed the action. Trusted
+  // callers only: a public route must omit it or anyone could speak for a
+  // colleague.
+  createdBy: id.nullish(),
 });
 export type AddIncidentNoteInput = z.infer<typeof AddIncidentNoteInput>;
 
```

---

### Incident Patch 4: `a41c8a4e` (2026-10-02)
**Commit Message**: fix: date-time picker (#2836)

* fix: date-time picker

* fix: format

* fix: review

* fix: format

**File**: `apps/dashboard/src/components/common/date-time-picker.tsx` (added, +122/-0)
```diff
@@ -0,0 +1,122 @@
+"use client";
+
+import { Calendar as CalendarIcon, Clock } from "@openstatus/icons";
+import { Button } from "@openstatus/ui/components/ui/button";
+import { Calendar } from "@openstatus/ui/components/ui/calendar";
+import { Input } from "@openstatus/ui/components/ui/input";
+import { Label } from "@openstatus/ui/components/ui/label";
+import {
+  Popover,
+  PopoverContent,
+  PopoverTrigger,
+} from "@openstatus/ui/components/ui/popover";
+import { useIsMobile } from "@openstatus/ui/hooks/use-mobile";
+import { cn } from "@openstatus/ui/lib/utils";
+import { format, startOfDay } from "date-fns";
+import { useId } from "react";
+
+type DateTimePickerProps = {
+  value: Date;
+  onChange: (date: Date) => void;
+  /** Bounds, inclusive; a picked time is clamped into them. */
+  min?: Date;
+  max?: Date;
+} & Omit<React.ComponentProps<typeof Button>, "value" | "onChange">;
+
+/**
+ * Calendar + time field in a popover. The time input is uncontrolled: a
+ * controlled one gets its value attribute rewritten per keystroke and WebKit
+ * then drops the focused segment. It only follows `value` on open, so an
+ * external change while the popover is open is not reflected in it.
+ */
+export function DateTimePicker({
+  value,
+  onChange,
+  min,
+  max,
+  className,
+  size = "sm",
+  ...props
+}: DateTimePickerProps) {
+  const mobile = useIsMobile();
+  const id = useId();
+
+  /** Clamps into the bounds and reports a change; returns what was applied. */
+  function commit(next: Date) {
+    if (Number.isNaN(next.getTime())) return null;
+    const clamped = min && next < min ? min : max && next > max ? max : next;
+    if (clamped.getTime() !== value.getTime()) onChange(clamped);
+    return clamped;
+  }
+
+  return (
+    <Popover modal>
+      <PopoverTrigger asChild>
+        <Button
+          type="button"
+          variant="outline"
+          size={size}
+          className={cn("justify-start font-normal", className)}
+          {...props}
+        >
+          {format(value, "PP, h:mm a")}
+          <CalendarIcon className="text-muted-foreground ml-auto" />
+        </Button>
+      </PopoverTrigger>
+      <PopoverContent
+        className="pointer-events-auto w-auto p-0"
+        align="start"
+        side={mobile ? "bottom" : "left"}
+      >
+        <Calendar
+          mode="single"
+          selected={value}
+          defaultMonth={value}
+          onSelect={(day) => {
+            if (!day) return;
+            const next = new Date(day);
+            next.setHours(
+              value.getHours(),
+              value.getMinutes(),
+              value.getSeconds(),
+              value.getMilliseconds(),
+            );
+            commit(next);
+          }}
+          disabled={(day) =>
+            (min ? day < startOfDay(min) : false) || (max ? day > max : false)
+          }
+          initialFocus
+        />
+        <div className="flex items-center gap-3 border-t p-3">
+          <Label htmlFor={id} className="text-xs">
+            Time
+          </Label>
+          <div className="relative grow">
+            <Input
+              id={id}
+              type="time"
+              defaultValue={format(value, "HH:mm")}
+              className="peer appearance-none ps-9 [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
+              onChange={(e) => {
+                // "" while a segment is cleared
+                if (!e.target.value) return;
+                const [hours, minutes] = e.target.value.split(":").map(Number);
+                const next = new Date(value);
+                next.setHours(hours, minutes);
+                const applied = commit(next);
+                // show the clamped time instead of what was typed
+                if (applied && applied.getTime() !== next.getTime()) {
+                  e.target.value = format(applied, "HH:mm");
+                }
+              }}
+            />
+            <div className="text-muted-foreground/80 pointer-events-none absolute inset-y-0 start-0 flex items-center justify-center ps-3 peer-disabled:opacity-50">
+              <Clock size={16} aria-hidden="true" />
+            </div>
+          </div>
+        </div>
+      </PopoverContent>
+    </Popover>
+  );
+}
```

**File**: `apps/dashboard/src/components/content/property-list.tsx` (modified, +18/-0)
```diff
@@ -3,6 +3,7 @@ import { Input } from "@openstatus/ui/components/ui/input";
 import { SelectTrigger } from "@openstatus/ui/components/ui/select";
 import { cn } from "@openstatus/ui/lib/utils";
 
+import { DateTimePicker } from "@/components/common/date-time-picker";
 import { Link } from "@/components/common/link";
 
 export function PropertyList({
@@ -136,3 +137,20 @@ export function PropertyInput({
     />
   );
 }
+
+export function PropertyDateTimePicker({
+  className,
+  ...props
+}: React.ComponentProps<typeof DateTimePicker>) {
+  return (
+    <DateTimePicker
+      className={cn(
+        propertyControlClassName,
+        // the outline variant re-adds a border and tint in dark mode
+        "data-[state=open]:bg-accent dark:hover:bg-accent/50 md:text-sm dark:border-transparent",
+        className,
+      )}
+      {...props}
+    />
+  );
+}
```

**File**: `apps/dashboard/src/components/forms/incident/form.tsx` (modified, +11/-7)
```diff
@@ -28,14 +28,14 @@ import { useForm } from "react-hook-form";
 import { toast } from "sonner";
 import { z } from "zod";
 
+import { DateTimePicker } from "@/components/common/date-time-picker";
 import { Link } from "@/components/common/link";
 import {
   FormCardContent,
   FormCardSeparator,
 } from "@/components/forms/form-card";
 import { useFormSheetDirty } from "@/components/forms/form-sheet";
 import { personName, severityConfig } from "@/data/managed-incidents.client";
-import { formatDateForInput } from "@/lib/formatter";
 import { useTRPC } from "@/lib/trpc/client";
 import { errorMessage } from "@/lib/trpc/error";
 
@@ -47,10 +47,9 @@ const schema = z.object({
   summary: z.string().max(4000),
   commanderId: z.string(),
   startedAt: z
-    .string()
-    .min(1, "Start time is required.")
+    .date()
     .refine(
-      (value) => new Date(value) <= new Date(),
+      (value) => value <= new Date(),
       "Start time cannot be in the future.",
     ),
   statusReportId: z.string(),
@@ -96,7 +95,7 @@ export function FormDeclareIncident({
       // user.get is prefetched in the dashboard layout, so it is hydrated
       // before the sheet can mount and the default is never NONE for members.
       commanderId: user ? String(user.id) : NONE,
-      startedAt: formatDateForInput(new Date()),
+      startedAt: new Date(),
       statusReportId: NONE,
       openSlackChannel: slack === "ready",
       ...defaultValues,
@@ -120,7 +119,7 @@ export function FormDeclareIncident({
           summary: values.summary || undefined,
           commanderId:
             values.commanderId === NONE ? null : Number(values.commanderId),
-          startedAt: new Date(values.startedAt),
+          startedAt: values.startedAt,
           statusReportId:
             values.statusReportId === NONE
               ? undefined
@@ -239,7 +238,12 @@ export function FormDeclareIncident({
               <FormItem>
                 <FormLabel>Started at</FormLabel>
                 <FormControl>
-                  <Input type="datetime-local" {...field} />
+                  <DateTimePicker
+                    value={field.value}
+                    onChange={field.onChange}
+                    max={new Date()}
+                    className="w-[240px]"
+                  />
                 </FormControl>
                 <FormDescription>
                   When the impact began. Set it in the past to record an
```

**File**: `apps/dashboard/src/components/forms/maintenance/form.tsx` (modified, +27/-195)
```diff
@@ -1,9 +1,6 @@
 "use client";
 
 import { zodResolver } from "@hookform/resolvers/zod";
-import { Calendar as CalendarIcon, Clock } from "@openstatus/icons";
-import { Button } from "@openstatus/ui/components/ui/button";
-import { Calendar } from "@openstatus/ui/components/ui/calendar";
 import { Checkbox } from "@openstatus/ui/components/ui/checkbox";
 import {
   Form,
@@ -16,25 +13,20 @@ import {
 } from "@openstatus/ui/components/ui/form";
 import { Input } from "@openstatus/ui/components/ui/input";
 import { Label } from "@openstatus/ui/components/ui/label";
-import {
-  Popover,
-  PopoverContent,
-  PopoverTrigger,
-} from "@openstatus/ui/components/ui/popover";
 import { TabsContent } from "@openstatus/ui/components/ui/tabs";
 import { TabsList, TabsTrigger } from "@openstatus/ui/components/ui/tabs";
 import { Tabs } from "@openstatus/ui/components/ui/tabs";
 import { Textarea } from "@openstatus/ui/components/ui/textarea";
-import { useIsMobile } from "@openstatus/ui/hooks/use-mobile";
 import { cn } from "@openstatus/ui/lib/utils";
 import { useQuery } from "@tanstack/react-query";
 import { isTRPCClientError } from "@trpc/client";
-import { addDays, format } from "date-fns";
+import { addDays } from "date-fns";
 import React, { useTransition } from "react";
 import { useForm } from "react-hook-form";
 import { toast } from "sonner";
 import { z } from "zod";
 
+import { DateTimePicker } from "@/components/common/date-time-picker";
 import {
   EmptyStateContainer,
   EmptyStateTitle,
@@ -80,7 +72,6 @@ export function FormMaintenance({
 }) {
   const trpc = useTRPC();
   const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());
-  const mobile = useIsMobile();
   const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
   const form = useForm<FormValues>({
     resolver: zodResolver(schema),
@@ -158,101 +149,25 @@ export function FormMaintenance({
             render={({ field }) => (
               <FormItem className="flex flex-col">
                 <FormLabel>Start Date</FormLabel>
-                <Popover modal>
-                  <FormControl>
-                    <PopoverTrigger asChild>
-                      <Button
-                        type="button"
-                        variant="outline"
-                        size="sm"
-                        className={cn(
-                          "w-[240px] pl-3 text-left font-normal",
-                          !field.value && "text-muted-foreground",
-                        )}
-                      >
-                        {field.value ? (
-                          format(field.value, "PPP 'at' h:mm a")
-                        ) : (
-                          <span>Pick a date</span>
-                        )}
-                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
-                      </Button>
-                    </PopoverTrigger>
-                  </FormControl>
-                  <PopoverContent
-                    className="pointer-events-auto w-auto p-0"
-                    align="start"
-                    side={mobile ? "bottom" : "left"}
-                  >
-                    <Calendar
-                      mode="single"
-                      selected={field.value}
-                      onSelect={(selectedDate) => {
-                        if (!selectedDate) return;
-
-                        const newDate = new Date(selectedDate);
-                        newDate.setHours(
-                          field.value.getHours(),
-                          field.value.getMinutes(),
-                          field.value.getSeconds(),
-                          field.value.getMilliseconds(),
+                <FormControl>
+                  <DateTimePicker
+                    value={field.value}
+                    className="w-[240px]"
+                    onChange={(date) => {
+                      // a start moved past the end drags the end along,
+                      // keeping the duration
+                      if (watchEndDate && date > watchEndDate) {
+                        const duration =
+                          watchEndDate.getTime() - field.value.getTime();
+                        form.setValue(
+                          "endDate",
+                          new Date(date.getTime() + duration),
                         );
-                        field.onChange(newDate);
-
-                        // NOTE: if end date is before start date, set it to the same day as the start date
-                        if (watchEndDate && newDate > watchEndDate) {
-                          form.setValue("endDate", newDate);
-                        }
-                      }}
-                      initialFocus
-                    />
-                    <div className="border-t p-3">
-                      <div className="flex items-center gap-3">
-                        <Label htmlFor="time-start" className="text-xs">
-                          Ent
```

**File**: `apps/dashboard/src/components/forms/status-report-update/form.tsx` (modified, +10/-100)
```diff
@@ -3,9 +3,6 @@
 import { zodResolver } from "@hookform/resolvers/zod";
 import { pageComponentImpact } from "@openstatus/db/src/schema/page_components/constants";
 import { statusReportStatus } from "@openstatus/db/src/schema/status_reports/constants";
-import { Calendar as CalendarIcon, Clock } from "@openstatus/icons";
-import { Button } from "@openstatus/ui/components/ui/button";
-import { Calendar } from "@openstatus/ui/components/ui/calendar";
 import { Checkbox } from "@openstatus/ui/components/ui/checkbox";
 import {
   Form,
@@ -16,13 +13,7 @@ import {
   FormLabel,
   FormMessage,
 } from "@openstatus/ui/components/ui/form";
-import { Input } from "@openstatus/ui/components/ui/input";
 import { Label } from "@openstatus/ui/components/ui/label";
-import {
-  PopoverContent,
-  PopoverTrigger,
-} from "@openstatus/ui/components/ui/popover";
-import { Popover } from "@openstatus/ui/components/ui/popover";
 import {
   Select,
   SelectContent,
@@ -34,16 +25,15 @@ import { TabsContent } from "@openstatus/ui/components/ui/tabs";
 import { TabsList, TabsTrigger } from "@openstatus/ui/components/ui/tabs";
 import { Tabs } from "@openstatus/ui/components/ui/tabs";
 import { Textarea } from "@openstatus/ui/components/ui/textarea";
-import { useIsMobile } from "@openstatus/ui/hooks/use-mobile";
 import { cn } from "@openstatus/ui/lib/utils";
 import { useQuery } from "@tanstack/react-query";
 import { isTRPCClientError } from "@trpc/client";
-import { format } from "date-fns";
 import React, { useTransition } from "react";
 import { useForm } from "react-hook-form";
 import { toast } from "sonner";
 import { z } from "zod";
 
+import { DateTimePicker } from "@/components/common/date-time-picker";
 import { ProcessMessage } from "@/components/content/process-message";
 import {
   FormCardContent,
@@ -88,7 +78,6 @@ export function FormStatusReportUpdate({
 }) {
   const trpc = useTRPC();
   const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());
-  const mobile = useIsMobile();
   const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
   const form = useForm<FormValues>({
     resolver: zodResolver(schema),
@@ -202,94 +191,15 @@ export function FormStatusReportUpdate({
             render={({ field }) => (
               <FormItem className="flex flex-col">
                 <FormLabel>Date</FormLabel>
-                <Popover modal>
-                  <FormControl>
-                    <PopoverTrigger asChild>
-                      <Button
-                        type="button"
-                        variant="outline"
-                        size="sm"
-                        className={cn(
-                          "w-[240px] pl-3 text-left font-normal",
-                          !field.value && "text-muted-foreground",
-                        )}
-                      >
-                        {field.value ? (
-                          format(field.value, "PPP 'at' h:mm a")
-                        ) : (
-                          <span>Pick a date</span>
-                        )}
-                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
-                      </Button>
-                    </PopoverTrigger>
-                  </FormControl>
-                  <PopoverContent
-                    className="pointer-events-auto w-auto p-0"
-                    align="start"
-                    side={mobile ? "bottom" : "left"}
-                  >
-                    <Calendar
-                      mode="single"
-                      selected={field.value}
-                      onSelect={(selectedDate) => {
-                        if (!selectedDate) return;
-                        const newDate = new Date(selectedDate);
-                        newDate.setHours(
-                          field.value.getHours(),
-                          field.value.getMinutes(),
-                          field.value.getSeconds(),
-                          field.value.getMilliseconds(),
-                        );
-                        field.onChange(newDate);
-                      }}
-                      disabled={(date) =>
-                        date > new Date() || date < new Date("1900-01-01")
-                      }
-                      initialFocus
-                    />
-                    <div className="border-t p-3">
-                      <div className="flex items-center gap-3">
-                        <Label htmlFor="time" className="text-xs">
-                          Enter time
-                        </Label>
-                        <div className="relative grow">
-                          <Input
-                            id="time"
-                            type="time"
-                            step="1"
-                            defaultValue={new Date().toTimeString().slice(0, 8)}
-                            className="peer appearance-none ps-9 [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-cal
```

**File**: `apps/dashboard/src/components/forms/status-report/form.tsx` (modified, +10/-101)
```diff
@@ -3,9 +3,6 @@
 import { zodResolver } from "@hookform/resolvers/zod";
 import { pageComponentImpact } from "@openstatus/db/src/schema/page_components/constants";
 import { statusReportStatus } from "@openstatus/db/src/schema/status_reports/constants";
-import { Calendar as CalendarIcon, Clock } from "@openstatus/icons";
-import { Button } from "@openstatus/ui/components/ui/button";
-import { Calendar } from "@openstatus/ui/components/ui/calendar";
 import { Checkbox } from "@openstatus/ui/components/ui/checkbox";
 import {
   Form,
@@ -18,11 +15,6 @@ import {
 } from "@openstatus/ui/components/ui/form";
 import { Input } from "@openstatus/ui/components/ui/input";
 import { Label } from "@openstatus/ui/components/ui/label";
-import {
-  Popover,
-  PopoverContent,
-  PopoverTrigger,
-} from "@openstatus/ui/components/ui/popover";
 import {
   Select,
   SelectContent,
@@ -34,16 +26,15 @@ import { TabsContent } from "@openstatus/ui/components/ui/tabs";
 import { TabsList, TabsTrigger } from "@openstatus/ui/components/ui/tabs";
 import { Tabs } from "@openstatus/ui/components/ui/tabs";
 import { Textarea } from "@openstatus/ui/components/ui/textarea";
-import { useIsMobile } from "@openstatus/ui/hooks/use-mobile";
 import { cn } from "@openstatus/ui/lib/utils";
 import { useQuery } from "@tanstack/react-query";
 import { isTRPCClientError } from "@trpc/client";
-import { format } from "date-fns";
 import React, { useTransition } from "react";
 import { useForm } from "react-hook-form";
 import { toast } from "sonner";
 import { z } from "zod";
 
+import { DateTimePicker } from "@/components/common/date-time-picker";
 import {
   EmptyStateContainer,
   EmptyStateTitle,
@@ -102,7 +93,6 @@ export function FormStatusReport({
 }) {
   const trpc = useTRPC();
   const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());
-  const mobile = useIsMobile();
   const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
   const form = useForm<FormValues>({
     resolver: zodResolver(defaultValues ? updateSchema : schema),
@@ -226,96 +216,15 @@ export function FormStatusReport({
                 render={({ field }) => (
                   <FormItem className="flex flex-col">
                     <FormLabel>Date</FormLabel>
-                    <Popover modal>
-                      <FormControl>
-                        <PopoverTrigger asChild>
-                          <Button
-                            type="button"
-                            variant="outline"
-                            size="sm"
-                            className={cn(
-                              "w-[240px] pl-3 text-left font-normal",
-                              !field.value && "text-muted-foreground",
-                            )}
-                          >
-                            {field.value ? (
-                              format(field.value, "PPP 'at' h:mm a")
-                            ) : (
-                              <span>Pick a date</span>
-                            )}
-                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
-                          </Button>
-                        </PopoverTrigger>
-                      </FormControl>
-                      <PopoverContent
-                        className="pointer-events-auto w-auto p-0"
-                        align="start"
-                        side={mobile ? "bottom" : "left"}
-                      >
-                        <Calendar
-                          mode="single"
-                          selected={field.value}
-                          onSelect={(selectedDate) => {
-                            if (!selectedDate) return;
-                            const newDate = new Date(selectedDate);
-                            newDate.setHours(
-                              field.value.getHours(),
-                              field.value.getMinutes(),
-                              field.value.getSeconds(),
-                              field.value.getMilliseconds(),
-                            );
-                            field.onChange(newDate);
-                          }}
-                          disabled={(date) =>
-                            date > new Date() || date < new Date("1900-01-01")
-                          }
-                          initialFocus
-                        />
-                        <div className="border-t p-3">
-                          <div className="flex items-center gap-3">
-                            <Label htmlFor="time" className="text-xs">
-                              Enter time
-                            </Label>
-                            <div className="relative grow">
-                              <Input
-                                id="time"
-                                type="time"
-                                step="1"
-                                defaultValue={new Date()
-                             
```

**File**: `apps/dashboard/src/components/incidents/declare-from-row.tsx` (modified, +1/-4)
```diff
@@ -4,7 +4,6 @@ import { Button } from "@openstatus/ui/components/ui/button";
 import { useQuery } from "@tanstack/react-query";
 
 import { useFeature } from "@/hooks/use-feature";
-import { formatDateForInput } from "@/lib/formatter";
 import { useTRPC } from "@/lib/trpc/client";
 
 import {
@@ -41,9 +40,7 @@ export function DeclareFromRow({
       defaultValues={{
         title,
         // epoch = legacy report without dates; prefill now instead
-        startedAt: formatDateForInput(
-          startedAt.getTime() === 0 ? new Date() : startedAt,
-        ),
+        startedAt: startedAt.getTime() === 0 ? new Date() : startedAt,
         ...(statusReportId ? { statusReportId: String(statusReportId) } : {}),
       }}
     >
```

**File**: `apps/dashboard/src/components/maintenances/maintenance-properties.tsx` (modified, +31/-32)
```diff
@@ -10,7 +10,7 @@ import { StatusDot } from "@/components/common/status-dot";
 import { UserAvatar } from "@/components/common/user-avatar";
 import {
   Property,
-  PropertyInput,
+  PropertyDateTimePicker,
   PropertyLabel,
   PropertyLink,
   PropertyList,
@@ -22,7 +22,6 @@ import {
   maintenanceStatusConfig,
 } from "@/data/overview-events.client";
 import { useHydrated } from "@/hooks/use-hydrated";
-import { formatDateForInput } from "@/lib/formatter";
 
 import { useUpdateMaintenance } from "./use-update-maintenance";
 
@@ -57,24 +56,25 @@ export function MaintenanceProperties({
   status: MaintenanceStatus;
   publicUrl: string;
 }) {
-  // datetime-local values and the timezone are browser-local
+  // the formatted dates and the timezone are browser-local
   const hydrated = useHydrated();
   const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
-  // null = pristine: the inputs follow the server copy until edited.
-  const [draft, setDraft] = useState<{ from: string; to: string } | null>(null);
-  const serverFrom = formatDateForInput(maintenance.from);
-  const serverTo = formatDateForInput(maintenance.to);
-  const from = draft?.from ?? serverFrom;
-  const to = draft?.to ?? serverTo;
+  // null = pristine: the pickers follow the server copy until edited.
+  const [draft, setDraft] = useState<{ from: Date; to: Date } | null>(null);
+  const from = draft?.from ?? maintenance.from;
+  const to = draft?.to ?? maintenance.to;
   const { update, isPending } = useUpdateMaintenance(maintenance.id, {
     onSuccess: () => {
       toast.success("Schedule saved");
       setDraft(null);
     },
   });
 
-  const dirty = draft !== null && (from !== serverFrom || to !== serverTo);
-  const invalid = !from || !to || new Date(to) <= new Date(from);
+  const dirty =
+    draft !== null &&
+    (from.getTime() !== maintenance.from.getTime() ||
+      to.getTime() !== maintenance.to.getTime());
+  const invalid = to <= from;
   const author = maintenance.createdByUser;
   const editor = distinctEditor(maintenance);
 
@@ -96,37 +96,36 @@ export function MaintenanceProperties({
       <Property>
         <PropertyLabel>From</PropertyLabel>
         <PropertyValue>
-          <PropertyInput
-            type="datetime-local"
-            aria-label="From"
-            value={hydrated ? from : ""}
-            onChange={(e) => setDraft({ from: e.target.value, to })}
-          />
+          {hydrated ? (
+            <PropertyDateTimePicker
+              aria-label="From"
+              value={from}
+              onChange={(date) => setDraft({ from: date, to })}
+            />
+          ) : (
+            <div className="h-8" />
+          )}
         </PropertyValue>
       </Property>
       <Property>
         <PropertyLabel>To</PropertyLabel>
         <PropertyValue className="flex-wrap">
-          <PropertyInput
-            type="datetime-local"
-            aria-label="To"
-            value={hydrated ? to : ""}
-            onChange={(e) => setDraft({ from, to: e.target.value })}
-          />
+          {hydrated ? (
+            <PropertyDateTimePicker
+              aria-label="To"
+              value={to}
+              onChange={(date) => setDraft({ from, to: date })}
+            />
+          ) : (
+            <div className="h-8" />
+          )}
           {dirty ? (
             <div className="grid w-full grid-cols-2 gap-1 font-sans">
               <Button
                 size="sm"
                 className="h-7"
                 disabled={invalid || isPending}
-                // an untouched field keeps its Date: the input drops seconds
-                onClick={() =>
-                  update({
-                    startDate:
-                      from === serverFrom ? maintenance.from : new Date(from),
-                    endDate: to === serverTo ? maintenance.to : new Date(to),
-                  })
-                }
+                onClick={() => update({ startDate: from, endDate: to })}
               >
                 Save
               </Button>
@@ -139,7 +138,7 @@ export function MaintenanceProperties({
               >
                 Reset
               </Button>
-              {from && to && invalid ? (
+              {invalid ? (
                 <span className="text-destructive col-span-full text-xs">
                   End must be after start
                 </span>
```

---

### Incident Patch 5: `0d88ea61` (2026-10-02)
**Commit Message**: fix(web): don't repeat the provider in external component names (#2815)

Component pages built their display name as `${service.name} ${component.name}`,
so a Zoom component already named "Zoom AI" rendered as "Zoom Zoom AI" in the
page title, og/twitter title, H1, lead answer, report-issue block, JSON-LD
(WebPage name, FAQ question) and the OG image.

Add getComponentFullName() and use it in all of those places. The provider is
only skipped when the component name already starts with it followed by a
space (or equals it), case-insensitively. "Zoom" + "Web SDK" still yields
"Zoom Web SDK", and "Zoomify" / "Rooms for Zoom" keep the prefix. Names are
trimmed and inner whitespace collapsed; an empty name falls back to the other.

URLs, canonicals, slugs and source data are unchanged.

Co-authored-by: Claude Sonnet 5.5 <[REDACTED_EMAIL]>

**File**: `apps/web/src/app/(landing)/status/[id]/[component]/component-detail.tsx` (modified, +8/-8)
```diff
@@ -18,7 +18,7 @@ import {
   ContentBoxTitle,
 } from "../../../content-box";
 import { ExternalServicePill } from "../../external-service-pill";
-import { formatRelative } from "../../utils";
+import { formatRelative, getComponentFullName } from "../../utils";
 import { HistoryBars } from "../history-bars";
 import { ReportIssue } from "../report-issue";
 
@@ -77,18 +77,19 @@ function formatTimestamp(value: string | null | undefined): string | null {
 function jsonLd(args: {
   serviceName: string;
   componentName: string;
+  fullName: string;
   serviceUrl: string;
   componentUrl: string;
   answer: string;
 }) {
   return createJsonLDGraph([
     getJsonLDWebPage({
-      name: `${args.serviceName} ${args.componentName} Status`,
+      name: `${args.fullName} Status`,
       url: args.componentUrl,
     }),
     getJsonLDFAQPage([
       {
-        question: `Is ${args.serviceName} ${args.componentName} down?`,
+        question: `Is ${args.fullName} down?`,
         answer: args.answer,
       },
     ]),
@@ -154,7 +155,7 @@ export function ComponentDetail({
   if (!data.found || !data.service || !data.component) return null;
   const { service, component, history, incidents, overlayIncidents } = data;
 
-  const fullName = `${service.name} ${component.name}`;
+  const fullName = getComponentFullName(service.name, component.name);
   const answer = answerFor({
     fullName,
     indicator: component.indicator,
@@ -167,6 +168,7 @@ export function ComponentDetail({
   const ld = jsonLd({
     serviceName: service.name,
     componentName: component.name,
+    fullName,
     serviceUrl,
     componentUrl,
     answer,
@@ -176,9 +178,7 @@ export function ComponentDetail({
     <section className="prose dark:prose-invert mb-12 max-w-none">
       <JsonLd graph={ld} />
 
-      <h1>
-        Is {service.name} {component.name} down?
-      </h1>
+      <h1>Is {fullName} down?</h1>
       <p>
         {answer} Below you'll find the live {component.name} status, uptime over
         the last {days} days, and recent incidents affecting {component.name}.
@@ -214,7 +214,7 @@ export function ComponentDetail({
       <div className="not-prose mt-6 flex flex-col gap-2">
         <ReportIssue
           slug={service.slug}
-          name={`${service.name} ${component.name}`}
+          name={fullName}
           componentSlug={component.slug}
         />
         {component.reporters > 0 ? (
```

**File**: `apps/web/src/app/(landing)/status/[id]/[component]/page.tsx` (modified, +5/-2)
```diff
@@ -18,6 +18,7 @@ import {
   ContentBoxDescription,
   ContentBoxTitle,
 } from "../../../content-box";
+import { getComponentFullName } from "../../utils";
 import { ComponentDetail } from "./component-detail";
 
 export const dynamic = "force-dynamic";
@@ -38,7 +39,7 @@ export async function generateMetadata(args: {
     return { ...defaultMetadata, title: "Not Found" };
   }
 
-  const fullName = `${service.name} ${component.name}`;
+  const fullName = getComponentFullName(service.name, component.name);
   const title = `Is ${fullName} Down? ${fullName} Status & History`;
   const description = `Is ${component.name} (${service.name}) down right now? Check the live status, uptime over the last ${HISTORY_DAYS} days, and recent incidents for ${component.name} tracked by OpenStatus.`;
   const canonicalUrl = `${BASE_URL}/status/${service.slug}/${component.slug}`;
@@ -77,6 +78,8 @@ export default async function Page(args: { params: Promise<RouteParams> }) {
     permanentRedirect(`/status/${service.slug}/${component.slug}`);
   }
 
+  const fullName = getComponentFullName(service.name, component.name);
+
   await api.externalService.component.prefetch({
     serviceSlug: service.slug,
     componentSlug: component.slug,
@@ -100,7 +103,7 @@ export default async function Page(args: { params: Promise<RouteParams> }) {
           fallback={
             <section className="prose dark:prose-invert mb-12 max-w-none">
               <p className="text-muted-foreground">
-                Loading {service.name} {component.name} status…
+                Loading {fullName} status…
               </p>
             </section>
           }
```

**File**: `apps/web/src/app/(landing)/status/utils.test.ts` (added, +52/-0)
```diff
@@ -0,0 +1,52 @@
+import { expect } from "@std/expect";
+import { describe, test } from "@std/testing/bdd";
+
+import { getComponentFullName } from "./utils";
+
+describe("getComponentFullName", () => {
+  test("does not repeat the provider already in the component name", () => {
+    expect(getComponentFullName("Zoom", "Zoom AI")).toBe("Zoom AI");
+  });
+
+  test("prefixes the provider when the component name lacks it", () => {
+    expect(getComponentFullName("Zoom", "Web SDK")).toBe("Zoom Web SDK");
+  });
+
+  test("matches the provider prefix case-insensitively", () => {
+    expect(getComponentFullName("Zoom", "zoom Chat")).toBe("zoom Chat");
+  });
+
+  test("component equal to the provider name", () => {
+    expect(getComponentFullName("Zoom", "Zoom")).toBe("Zoom");
+  });
+
+  test("requires a word boundary after the provider name", () => {
+    expect(getComponentFullName("Zoom", "Zoomify")).toBe("Zoom Zoomify");
+  });
+
+  test("keeps the provider name when it appears later", () => {
+    expect(getComponentFullName("Zoom", "Rooms for Zoom")).toBe(
+      "Zoom Rooms for Zoom",
+    );
+  });
+
+  test("trims surrounding whitespace", () => {
+    expect(getComponentFullName("  Zoom ", " Zoom AI  ")).toBe("Zoom AI");
+    expect(getComponentFullName(" Zoom", "Web SDK ")).toBe("Zoom Web SDK");
+  });
+
+  test("collapses inner whitespace runs", () => {
+    expect(getComponentFullName("Zoom", "Zoom   AI")).toBe("Zoom AI");
+    expect(getComponentFullName("Zoom", "Zoom\tAI")).toBe("Zoom AI");
+    expect(getComponentFullName("Zoom  Video", "Web  SDK")).toBe(
+      "Zoom Video Web SDK",
+    );
+  });
+
+  test("falls back to the non-empty name", () => {
+    expect(getComponentFullName("Zoom", "")).toBe("Zoom");
+    expect(getComponentFullName("Zoom", "   ")).toBe("Zoom");
+    expect(getComponentFullName("", "Zoom AI")).toBe("Zoom AI");
+    expect(getComponentFullName("  ", "")).toBe("");
+  });
+});
```

**File**: `apps/web/src/app/(landing)/status/utils.ts` (modified, +16/-0)
```diff
@@ -17,6 +17,22 @@ export function isStale(fetchedAtMs: number): boolean {
   return Date.now() - fetchedAtMs > STALE_THRESHOLD_MS;
 }
 
+// Upstream component names often already carry the provider ("Zoom AI" on
+// Zoom), so prefixing blindly yields "Zoom Zoom AI".
+export function getComponentFullName(
+  serviceName: string,
+  componentName: string,
+): string {
+  const service = serviceName.trim().replace(/\s+/g, " ");
+  const component = componentName.trim().replace(/\s+/g, " ");
+  if (!component) return service;
+  if (!service) return component;
+  const lower = component.toLowerCase();
+  const prefix = service.toLowerCase();
+  if (lower === prefix || lower.startsWith(`${prefix} `)) return component;
+  return `${service} ${component}`;
+}
+
 // Natural-language answer to "Is <name> down?", used both as on-page lead copy
 // and as the FAQPage answer in JSON-LD. Mirrors getPillStyle semantics.
 export function getStatusAnswer(args: {
```

**File**: `apps/web/src/app/api/og/external-service/route.tsx` (modified, +4/-3)
```diff
@@ -2,7 +2,7 @@ import { readFile } from "node:fs/promises";
 
 import { ImageResponse } from "next/og";
 
-import { isStale } from "../../../(landing)/status/utils";
+import { getComponentFullName, isStale } from "../../../(landing)/status/utils";
 import {
   getComponentEscalation,
   getServiceEscalation,
@@ -133,6 +133,7 @@ export async function GET(req: Request) {
   if (componentResult?.service && componentResult.component) {
     const { service, component } = componentResult;
     isDetail = true;
+    const fullName = getComponentFullName(service.name, component.name);
     const esc = await getComponentEscalation({
       serviceId: service.id,
       componentId: component.id,
@@ -145,8 +146,8 @@ export async function GET(req: Request) {
     category = content.label;
     categoryDot = content.bg;
     title = esc.escalated
-      ? `Users reporting issues with ${service.name} ${component.name}`
-      : `Is ${service.name} ${component.name} down?`;
+      ? `Users reporting issues with ${fullName}`
+      : `Is ${fullName} down?`;
     description = "";
     footer = `${FOOTER}/${service.slug}/${component.slug}`;
   } else {
```

---

### Incident Patch 6: `81985014` (2026-10-02)
**Commit Message**: fix(importers): keep Checkly followRedirects on imported monitors (#2834)

**File**: `packages/importers/src/providers/checkly/mapper.test.ts` (modified, +5/-0)
```diff
@@ -114,6 +114,11 @@ describe("mapCheck", () => {
     expect(m.active).toBe(false);
     expect(m.method).toBe("POST");
   });
+
+  test("carries over the check's followRedirects setting", () => {
+    expect(mapCheck(MOCK_CHECKS[0], 1).followRedirects).toBe(true);
+    expect(mapCheck(MOCK_CHECKS[3], 1).followRedirects).toBe(false);
+  });
 });
 
 describe("deriveSlug", () => {
```

**File**: `packages/importers/src/providers/checkly/mapper.ts` (modified, +1/-0)
```diff
@@ -125,6 +125,7 @@ export function mapCheck(check: ChecklyCheck, workspaceId: number) {
     headers,
     body: req?.body ?? "",
     method: mapMethod(req?.method ?? "GET"),
+    followRedirects: req?.followRedirects ?? true,
     // Checkly maxResponseTime is the hard timeout (ms); default to 45s.
     timeout: check.maxResponseTime ?? 45000,
     sourceMonitorGroupId: check.groupId,
```

**File**: `packages/services/src/import/phase-writers.ts` (modified, +2/-0)
```diff
@@ -726,6 +726,7 @@ export async function writeMonitorsPhase(
         body: string;
         method: string;
         timeout: number;
+        followRedirects?: boolean;
         sourceMonitorGroupId: string | null;
       };
 
@@ -793,6 +794,7 @@ export async function writeMonitorsPhase(
             | "CONNECT"
             | "OPTIONS",
           timeout: data.timeout,
+          followRedirects: data.followRedirects,
         })
         .returning();
 
```

---

### Incident Patch 7: `f2e71de2` (2026-10-01)
**Commit Message**: fix: domain already in use error (#2831)

**File**: `packages/api/src/lib/vercel.ts` (modified, +1/-1)
```diff
@@ -119,7 +119,7 @@ function toDomainError(domain: string, code?: string): TRPCError {
     case "domain_already_in_use":
       return new TRPCError({
         code: "CONFLICT",
-        message: `The domain '${domain}' is already in use by another status page. Remove it there first or contact support.`,
+        message: `The domain '${domain}' is already in use. Remove it there first or contact support.`,
       });
     case "invalid_domain":
     case "not_found":
```

---

### Incident Patch 8: `6024aa00` (2026-09-29)
**Commit Message**: services: feature gate, requireRole, slack-user mapping (#2790)

* db: incident, incident_event and slack_user tables (#2789)

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

* services: feature gate, requireRole, slack-user mapping

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

---------

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `apps/dashboard/src/hooks/use-feature.ts` (modified, +3/-11)
```diff
@@ -1,19 +1,11 @@
+import type { Feature } from "@openstatus/services";
 import { useQuery } from "@tanstack/react-query";
 
 import { useTRPC } from "@/lib/trpc/client";
 
-/**
- * Record<feature, [workspaceId, ...]>
- */
-const features = {
-  "slack-agent": [1, 6850],
-};
-
-export function useFeature(feature: keyof typeof features) {
+export function useFeature(feature: Feature) {
   const trpc = useTRPC();
   const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());
 
-  if (!workspace) return false;
-
-  return features[feature]?.includes(workspace.id) ?? false;
+  return workspace?.features.includes(feature) ?? false;
 }
```

**File**: `packages/api/src/router/workspace.ts` (modified, +2/-0)
```diff
@@ -1,4 +1,5 @@
 import { Events } from "@openstatus/analytics";
+import { enabledFeatures } from "@openstatus/services";
 import {
   getTrialDaysLeft,
   getWorkspaceUsage,
@@ -17,6 +18,7 @@ export const workspaceRouter = createTRPCRouter({
   get: protectedProcedure.query(({ ctx }) => ({
     ...ctx.workspace,
     trialDaysLeft: getTrialDaysLeft(ctx.workspace.trialEndsAt),
+    features: enabledFeatures(ctx.workspace),
   })),
 
   usage: protectedProcedure.query(async ({ ctx }) => {
```

**File**: `packages/services/package.json` (modified, +4/-0)
```diff
@@ -113,6 +113,10 @@
       "import": "./src/private-location/index.ts",
       "types": "./src/private-location/index.ts"
     },
+    "./slack-user": {
+      "import": "./src/slack-user/index.ts",
+      "types": "./src/slack-user/index.ts"
+    },
     "./page-access": {
       "import": "./src/page-access/index.ts",
       "types": "./src/page-access/index.ts"
```

**File**: `packages/services/src/__tests__/features.test.ts` (added, +44/-0)
```diff
@@ -0,0 +1,44 @@
+import { expect } from "@std/expect";
+import { describe, test } from "@std/testing/bdd";
+
+import { ForbiddenError } from "../errors";
+import { isFeatureEnabled, requireFeature } from "../features";
+import type { Workspace } from "../types";
+
+const none = new Set<string>();
+
+describe("isFeatureEnabled", () => {
+  test("allowlisted workspace", () => {
+    expect(isFeatureEnabled({ id: 1 }, "incident-management", none)).toBe(true);
+  });
+
+  test("other workspace", () => {
+    expect(
+      isFeatureEnabled({ id: 987654321 }, "incident-management", none),
+    ).toBe(false);
+  });
+
+  test("env override enables it for every workspace", () => {
+    expect(
+      isFeatureEnabled(
+        { id: 987654321 },
+        "incident-management",
+        new Set(["incident-management"]),
+      ),
+    ).toBe(true);
+  });
+});
+
+describe("requireFeature", () => {
+  test("throws ForbiddenError when disabled", () => {
+    const processEnv: Record<string, string | undefined> = process.env;
+    if (processEnv.OPENSTATUS_FEATURES?.includes("slack-agent")) return;
+    const workspace = { id: 987654321 } as Workspace;
+    expect(() =>
+      requireFeature(
+        { workspace, actor: { type: "system", job: "test" } },
+        "slack-agent",
+      ),
+    ).toThrow(ForbiddenError);
+  });
+});
```

**File**: `packages/services/src/auth/__tests__/require-role.test.ts` (added, +97/-0)
```diff
@@ -0,0 +1,97 @@
+import { db } from "@openstatus/db";
+import {
+  addUserToWorkspace,
+  createUser,
+} from "@openstatus/db/src/test/factories";
+import { expect } from "@std/expect";
+import { beforeAll, describe, test } from "@std/testing/bdd";
+
+import {
+  createWorkspaceFixture,
+  makeApiKeyCtx,
+  makeSlackCtx,
+  makeSystemCtx,
+  makeUserCtx,
+} from "../../../test/helpers";
+import { ForbiddenError } from "../../errors";
+import type { Workspace } from "../../types";
+import { requireRole } from "../require-role";
+
+let workspace: Workspace;
+let ownerId: number;
+let adminId: number;
+let memberId: number;
+let outsiderId: number;
+
+beforeAll(async () => {
+  const fixture = await createWorkspaceFixture("team");
+  workspace = fixture.workspace;
+  ownerId = fixture.userId;
+  adminId = (await createUser()).id;
+  memberId = (await createUser()).id;
+  outsiderId = (await createUser()).id;
+  await addUserToWorkspace(adminId, workspace.id, "admin");
+  await addUserToWorkspace(memberId, workspace.id, "member");
+});
+
+describe("requireRole", () => {
+  test("user with an allowed role passes", async () => {
+    await requireRole(db, makeUserCtx(workspace, { userId: ownerId }), [
+      "owner",
+      "admin",
+    ]);
+    await requireRole(db, makeUserCtx(workspace, { userId: adminId }), [
+      "owner",
+      "admin",
+    ]);
+  });
+
+  test("member is rejected from an admin-only check", async () => {
+    await expect(
+      requireRole(db, makeUserCtx(workspace, { userId: memberId }), [
+        "owner",
+        "admin",
+      ]),
+    ).rejects.toThrow(ForbiddenError);
+  });
+
+  test("orUserId lets the named user through", async () => {
+    await requireRole(
+      db,
+      makeUserCtx(workspace, { userId: memberId }),
+      ["owner", "admin"],
+      { orUserId: memberId },
+    );
+  });
+
+  test("non-member is rejected even from member-level checks", async () => {
+    await expect(
+      requireRole(db, makeUserCtx(workspace, { userId: outsiderId }), [
+        "owner",
+        "admin",
+        "member",
+      ]),
+    ).rejects.toThrow(ForbiddenError);
+  });
+
+  test("slack actor resolves through its linked user", async () => {
+    const ctx = makeSlackCtx(workspace, {
+      teamId: "T1",
+      slackUserId: "U1",
+      userId: adminId,
+    });
+    await requireRole(db, ctx, ["owner", "admin"]);
+  });
+
+  test("api key without a user passes member-level only", async () => {
+    const ctx = makeApiKeyCtx(workspace, { keyId: "k1" });
+    await requireRole(db, ctx, ["owner", "admin", "member"]);
+    await expect(requireRole(db, ctx, ["owner", "admin"])).rejects.toThrow(
+      ForbiddenError,
+    );
+  });
+
+  test("system always passes", async () => {
+    await requireRole(db, makeSystemCtx(workspace, { job: "test" }), ["owner"]);
+  });
+});
```

**File**: `packages/services/src/auth/index.ts` (modified, +1/-0)
```diff
@@ -1,2 +1,3 @@
 export { matchesScope } from "./matches-scope";
+export { requireRole } from "./require-role";
 export { requireScope } from "./require-scope";
```

**File**: `packages/services/src/auth/require-role.ts` (added, +36/-0)
```diff
@@ -0,0 +1,36 @@
+import type { WorkspaceRole } from "@openstatus/db/src/schema";
+
+import { type DB, type ServiceContext, tryGetActorUserId } from "../context";
+import { ForbiddenError } from "../errors";
+import { getMembership } from "../member/membership";
+
+/**
+ * Assert the actor's workspace role is one of `roles`, or that the actor is
+ * `orUserId`. `system` always passes; key-based actors without a linked user
+ * pass only member-level checks.
+ */
+export async function requireRole(
+  db: DB,
+  ctx: ServiceContext,
+  roles: ReadonlyArray<WorkspaceRole>,
+  opts: { orUserId?: number | null } = {},
+): Promise<void> {
+  const { actor } = ctx;
+  if (actor.type === "system") return;
+
+  const userId = tryGetActorUserId(actor);
+  if (userId !== null) {
+    if (opts.orUserId != null && opts.orUserId === userId) return;
+    const membership = await getMembership(db, userId, ctx.workspace.id);
+    if (membership && roles.includes(membership.role)) return;
+    throw new ForbiddenError(`Requires one of the roles: ${roles.join(", ")}`);
+  }
+
+  if (
+    (actor.type === "apiKey" || actor.type === "mcp") &&
+    roles.includes("member")
+  ) {
+    return;
+  }
+  throw new ForbiddenError(`Requires one of the roles: ${roles.join(", ")}`);
+}
```

**File**: `packages/services/src/features.ts` (added, +45/-0)
```diff
@@ -0,0 +1,45 @@
+import type { ServiceContext } from "./context";
+import { ForbiddenError } from "./errors";
+import type { Workspace } from "./types";
+
+const featureWorkspaces = {
+  "slack-agent": [1, 6850],
+  "incident-management": [1, 6850],
+} satisfies Record<string, ReadonlyArray<number>>;
+
+export type Feature = keyof typeof featureWorkspaces;
+
+export const FEATURES = Object.keys(featureWorkspaces) as Feature[];
+
+// `OPENSTATUS_FEATURES` (comma list) turns a feature on for every workspace:
+// local dev, self-hosting and test runs.
+function featuresFromEnv(): Set<string> {
+  const processEnv: Record<string, string | undefined> = process.env;
+  const raw = processEnv.OPENSTATUS_FEATURES ?? "";
+  return new Set(
+    raw
+      .split(",")
+      .map((f) => f.trim())
+      .filter(Boolean),
+  );
+}
+
+export function isFeatureEnabled(
+  workspace: Pick<Workspace, "id">,
+  feature: Feature,
+  envFeatures: Set<string> = featuresFromEnv(),
+): boolean {
+  const ids: ReadonlyArray<number> = featureWorkspaces[feature];
+  return ids.includes(workspace.id) || envFeatures.has(feature);
+}
+
+export function enabledFeatures(workspace: Pick<Workspace, "id">): Feature[] {
+  const envFeatures = featuresFromEnv();
+  return FEATURES.filter((f) => isFeatureEnabled(workspace, f, envFeatures));
+}
+
+export function requireFeature(ctx: ServiceContext, feature: Feature): void {
+  if (!isFeatureEnabled(ctx.workspace, feature)) {
+    throw new ForbiddenError(`Feature not enabled: ${feature}`);
+  }
+}
```

---

### Incident Patch 9: `7a2a9cbc` (2026-09-28)
**Commit Message**: docs: add Kubernetes section to the self-hosting guide (#2787)

Co-authored-by: David A. Symons <[REDACTED_EMAIL]>

**File**: `apps/web/src/content/pages/docs/guides/self-hosting-openstatus.mdx` (modified, +21/-1)
```diff
@@ -12,7 +12,7 @@ You want to run openstatus on your own infrastructure instead of using the hoste
 
 ## Solution
 
-openstatus provides a Docker Compose setup that makes self-hosting straightforward. This guide walks you through deploying all necessary services and configuring your self-hosted instance.
+openstatus provides a Docker Compose setup that makes self-hosting straightforward. This guide walks you through deploying all necessary services and configuring your self-hosted instance. On Kubernetes, use the Helm chart instead — see [Running on Kubernetes](#running-on-kubernetes).
 
 > **Only want the status page?** If you already have monitoring elsewhere and just need somewhere to publish incidents, the [lightweight status-page-only setup](/docs/guides/self-host-status-page-only) runs four services instead of the full stack — no Tinybird, no probes, no API server.
 
@@ -357,6 +357,25 @@ Self-hosted deployments need external cron scheduling for background tasks. With
     If you skip this step, your private locations will show "error" status permanently even when actively reporting.
     </Aside>
 
+## Running on Kubernetes
+
+The [Helm chart](https://github.com/openstatusHQ/openstatus/tree/main/charts/openstatus) runs the same services as `docker-compose.github-packages.yaml` and automates the steps that don't need the dashboard:
+
+- Database migrations run before `workflows` starts, like the `db-migrate` container.
+- A post-install Job does Part 2 (steps 4–7): it deploys the Tinybird project and stores the token as both `TINY_BIRD_API_KEY` and `TINYBIRD_TOKEN`.
+- A CronJob calls `/cron/private-location-health` every 5 minutes (Part 4).
+- `AUTH_SECRET` and `CRON_SECRET` are generated on first install and kept on upgrade.
+
+```bash
+git clone https://github.com/openstatushq/openstatus
+cd openstatus
+helm install openstatus ./charts/openstatus -n openstatus --create-namespace \
+  --set urls.dashboard=https://openstatus.example.com \
+  --set urls.server=https://api.openstatus.example.com
+```
+
+The chart creates ClusterIP Services only, so expose the dashboard and status page with your own Ingress or Gateway. Workspace limits (step 9) and the probe (step 10) are still manual; the [chart README](https://github.com/openstatusHQ/openstatus/blob/main/charts/openstatus/README.md) has the commands.
+
 ## Configuring the AI assistant (optional)
 
 openstatus ships an in-dashboard AI assistant. It is **off by default** when self-hosting — the chat endpoint returns `503 "Chat is not configured"` until you point it at a model provider. Configure **one** of the two options below in your `.env.docker` (root) — or `apps/dashboard/.env` for a manual setup — then restart the dashboard.
@@ -470,5 +489,6 @@ Or simply `docker compose up -d db-migrate`, since the step is idempotent.
 ### Learn more
 
 - **[Docker Compose file](https://github.com/openstatusHQ/openstatus/blob/main/docker-compose.yaml)** — review the complete configuration.
+- **[Helm chart](https://github.com/openstatusHQ/openstatus/tree/main/charts/openstatus)** — run the stack on Kubernetes.
 - **[Private location reference](/docs/reference/private-location)** — technical specifications.
 - **[Join our Discord](https://www.openstatus.dev/discord)** — get help from the community.
```

---

### Incident Patch 10: `b6d08d4b` (2026-09-28)
**Commit Message**: fix(api): don't crash on import when STRIPE_SECRET_KEY is unset (#2783)

Self-hosted status-page returns 500 on every route with "Neither apiKey nor
config.authenticator provided" because the Stripe client is built with an empty key at
module load. The env schema already makes the key optional for self-hosting.

Co-authored-by: David A. Symons <[REDACTED_EMAIL]>

**File**: `packages/api/src/router/stripe/shared.ts` (modified, +3/-1)
```diff
@@ -4,7 +4,9 @@ import Stripe from "stripe";
 import { env } from "../../env";
 import { buildLimitsFromSubscription } from "./utils";
 
-export const stripe = new Stripe(env.STRIPE_SECRET_KEY ?? "", {
+// The constructor throws on an empty key, and this module is loaded at import
+// time. Self-hosted installs leave STRIPE_SECRET_KEY unset and never call Stripe.
+export const stripe = new Stripe(env.STRIPE_SECRET_KEY || "sk_unset", {
   apiVersion: "2026-08-26.dahlia",
   appInfo: {
     name: "OpenStatus",
```

---

### Incident Patch 11: `8b6d45ba` (2026-09-27)
**Commit Message**: fix: header logo image (#2781)

**File**: `apps/web/src/content/logo-with-context-menu.tsx` (modified, +1/-1)
```diff
@@ -19,7 +19,7 @@ export function LogoWithContextMenu() {
             alt="openstatus logo"
             width={20}
             height={20}
-            className="border-border dark:border-foreground rounded-full border"
+            className="border-border dark:border-foreground rounded-[50%] border"
           />
           <span className="hidden sm:block">openstatus</span>
           <div className="absolute right-0.5 bottom-0 hidden group-hover:block">
```

---

### Incident Patch 12: `dd838b4f` (2026-09-27)
**Commit Message**: fix(dashboard): prevent self-deletion in workspace members table (#2777)

**File**: `apps/dashboard/src/components/data-table/settings/members/data-table.tsx` (modified, +45/-31)
```diff
@@ -1,3 +1,4 @@
+import { Badge } from "@openstatus/ui/components/ui/badge";
 import {
   Table,
   TableBody,
@@ -15,6 +16,7 @@ import { useTRPC } from "@/lib/trpc/client";
 export function DataTable() {
   const trpc = useTRPC();
   const { data: members, refetch } = useQuery(trpc.member.list.queryOptions());
+  const { data: user } = useQuery(trpc.user.get.queryOptions());
   const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());
   const deleteMemberMutation = useMutation(
     trpc.member.delete.mutationOptions({
@@ -38,37 +40,49 @@ export function DataTable() {
         </TableRow>
       </TableHeader>
       <TableBody>
-        {members.map((item) => (
-          <TableRow key={item.user.id}>
-            <TableCell>
-              {item.user.name ?? (
-                <span className="text-muted-foreground">-</span>
-              )}
-            </TableCell>
-            <TableCell>{item.user.email}</TableCell>
-            <TableCell>{item.role}</TableCell>
-            <TableCell>
-              {formatDate(item.user.createdAt ?? item.createdAt)}
-            </TableCell>
-            <TableCell>
-              <div className="flex justify-end">
-                <QuickActions
-                  deleteAction={{
-                    confirmationValue: item.user.email ?? "user",
-                    description: workspace?.ssoEnabled
-                      ? "This workspace uses SSO. They can sign in again and rejoin automatically unless you also remove them from your identity provider."
-                      : undefined,
-                    // FIXME: when deleting myself, throws an error, should have been caught by the toast.error
-                    submitAction: async () =>
-                      await deleteMemberMutation.mutateAsync({
-                        id: item.user.id,
-                      }),
-                  }}
-                />
-              </div>
-            </TableCell>
-          </TableRow>
-        ))}
+        {members.map((item) => {
+          const currentUserId = user?.id;
+          const isMe = Boolean(currentUserId && item.user.id === currentUserId);
+          const canDelete = Boolean(
+            currentUserId && item.user.id !== currentUserId,
+          );
+
+          return (
+            <TableRow key={item.user.id}>
+              <TableCell>
+                <div className="flex items-center gap-2">
+                  {item.user.name ?? (
+                    <span className="text-muted-foreground">-</span>
+                  )}
+                  {isMe ? <Badge variant="secondary">You</Badge> : null}
+                </div>
+              </TableCell>
+              <TableCell>{item.user.email}</TableCell>
+              <TableCell>{item.role}</TableCell>
+              <TableCell>
+                {formatDate(item.user.createdAt ?? item.createdAt)}
+              </TableCell>
+              <TableCell>
+                {canDelete ? (
+                  <div className="flex justify-end">
+                    <QuickActions
+                      deleteAction={{
+                        confirmationValue: item.user.email ?? "user",
+                        description: workspace?.ssoEnabled
+                          ? "This workspace uses SSO. They can sign in again and rejoin automatically unless you also remove them from your identity provider."
+                          : undefined,
+                        submitAction: async () =>
+                          await deleteMemberMutation.mutateAsync({
+                            id: item.user.id,
+                          }),
+                      }}
+                    />
+                  </div>
+                ) : null}
+              </TableCell>
+            </TableRow>
+          );
+        })}
       </TableBody>
     </Table>
   );
```

---

### Incident Patch 13: `b25a9967` (2026-09-25)
**Commit Message**: fix(auth): preserve redirectTo in magic link invitation flow (#822) (#2749)

* fix(auth): preserve redirectTo in magic link invitation flow (#822)

* feat(dashboard): redesign invite page with FormCard

* refactor: sanitize redirect to

---------

Co-authored-by: Maximilian Kaske <[REDACTED_EMAIL]>

**File**: `apps/dashboard/src/app/(dashboard)/invite/client.tsx` (modified, +103/-36)
```diff
@@ -7,13 +7,29 @@ import { useQueryStates } from "nuqs";
 import { useTransition } from "react";
 import { toast } from "sonner";
 
+import { Link } from "@/components/common/link";
+import {
+  EmptyStateContainer,
+  EmptyStateDescription,
+  EmptyStateTitle,
+} from "@/components/content/empty-state";
 import {
   Section,
   SectionDescription,
   SectionGroup,
   SectionHeader,
   SectionTitle,
 } from "@/components/content/section";
+import {
+  FormCard,
+  FormCardContent,
+  FormCardDescription,
+  FormCardFooter,
+  FormCardFooterInfo,
+  FormCardHeader,
+  FormCardTitle,
+} from "@/components/forms/form-card";
+import { formatDate } from "@/lib/formatter";
 import { useTRPC } from "@/lib/trpc/client";
 import { switchWorkspace } from "@/lib/workspace-cookie";
 
@@ -42,11 +58,20 @@ export function Client() {
       <SectionGroup>
         <Section>
           <SectionHeader>
-            <SectionTitle className="text-destructive">Error</SectionTitle>
-            <SectionDescription className="font-mono">
-              {error.message}
+            <SectionTitle>Invitation</SectionTitle>
+            <SectionDescription>
+              This invitation can&apos;t be opened.
             </SectionDescription>
           </SectionHeader>
+          <EmptyStateContainer className="py-8">
+            <EmptyStateTitle>Invitation unavailable</EmptyStateTitle>
+            <EmptyStateDescription className="font-mono">
+              {error.message}
+            </EmptyStateDescription>
+            <Button size="sm" variant="outline" className="mt-2" asChild>
+              <Link href="/overview">Back to overview</Link>
+            </Button>
+          </EmptyStateContainer>
         </Section>
       </SectionGroup>
     );
@@ -55,48 +80,90 @@ export function Client() {
   if (!invitation) return null;
   if (invitation.acceptedAt) return null;
 
+  const { workspace } = invitation;
+
   return (
     <SectionGroup>
       <Section>
         <SectionHeader>
           <SectionTitle>Invitation</SectionTitle>
           <SectionDescription>
-            You&apos;ve been invited to join the workspace{" "}
-            {invitation.workspace.name ? (
-              <span className="font-semibold">{invitation.workspace.name}</span>
-            ) : (
-              <span className="font-mono">{invitation.workspace.slug}</span>
-            )}
-            .
+            Accepting switches you into the workspace. You can switch back
+            anytime from the sidebar.
           </SectionDescription>
         </SectionHeader>
-        <Button
-          size="sm"
-          onClick={() => {
-            startTransition(async () => {
-              try {
-                const promise = acceptInvitationMutation.mutateAsync({
-                  id: invitation.id,
-                });
-                toast.promise(promise, {
-                  loading: "Accepting invitation...",
-                  success: "Invitation accepted",
-                  error: (error) => {
-                    if (isTRPCClientError(error)) {
-                      return error.message;
-                    }
-                    return "Failed to accept invitation";
-                  },
+        <FormCard>
+          <FormCardHeader>
+            <FormCardTitle>Join workspace</FormCardTitle>
+            <FormCardDescription>
+              You were invited as{" "}
+              <span className="text-foreground font-mono">
+                {invitation.role}
+              </span>{" "}
+              via{" "}
+              <span className="text-foreground font-mono">
+                {invitation.email}
+              </span>
+              .
+            </FormCardDescription>
+          </FormCardHeader>
+          <FormCardContent>
+            <div className="flex items-center gap-3">
+              <div className="size-8 shrink-0 overflow-hidden rounded-lg">
+                <img
+                  src={`https://api.dicebear.com/9.x/glass/svg?seed=${workspace.slug}`}
+                  alt=""
+                />
+              </div>
+              <div className="grid min-w-0 text-sm leading-tight">
+                <div className="truncate font-medium">
+                  {workspace.name || "Untitled Workspace"}
+                </div>
+                <div className="truncate text-xs">
+                  <span className="font-commit-mono tracking-tight">
+                    {workspace.slug}
+                  </span>{" "}
+                  <span className="text-muted-foreground">
+                    {workspace.plan === "team" ? "pro" : workspace.plan}
+                  </span>
+                </div>
+              </div>
+            </div>
+          </FormCardContent>
+          <FormCardFooter>
+            <FormCardFooterInfo>
+              Invitation expires {formatDate(invitation.expiresAt)}.
+            </FormCardFooterInfo>
+            <Button
+              size="sm"
+              disabled={isPending}
+ 
```

**File**: `apps/dashboard/src/app/login/_components/actions.ts` (modified, +13/-5)
```diff
@@ -7,9 +7,20 @@ import { signIn } from "@/lib/auth";
 import { ssoLookupRateLimit } from "@/lib/rate-limit/sso-lookup";
 import { SSO_ORG_COOKIE } from "@/lib/sso-cookie";
 
+// Same-origin paths only; the Auth.js `redirect` callback is the second line
+// of defense, not the first.
+function sanitizeRedirectTo(raw: FormDataEntryValue | null) {
+  const value = String(raw ?? "");
+  return value.startsWith("/") && !value.startsWith("//") ? value : undefined;
+}
+
 export async function signInWithResendAction(formData: FormData) {
   try {
-    await signIn("resend", formData);
+    // next-auth lifts `redirectTo` into the magic link's `callbackUrl` itself.
+    await signIn("resend", {
+      email: String(formData.get("email") ?? ""),
+      redirectTo: sanitizeRedirectTo(formData.get("redirectTo")),
+    });
   } catch (e) {
     console.error(e);
   }
@@ -28,11 +39,8 @@ export async function startSsoSignIn(
   formData: FormData,
 ): Promise<SsoFormState> {
   const email = String(formData.get("email") ?? "");
-  const redirectToRaw = String(formData.get("redirectTo") ?? "");
   const redirectTo =
-    redirectToRaw.startsWith("/") && !redirectToRaw.startsWith("//")
-      ? redirectToRaw
-      : "/overview";
+    sanitizeRedirectTo(formData.get("redirectTo")) ?? "/overview";
 
   if (!email.includes("@")) return { error: GENERIC_ERROR };
 
```

**File**: `apps/dashboard/src/app/login/_components/magic-link-form.tsx` (modified, +8/-1)
```diff
@@ -8,10 +8,14 @@ import { toast } from "sonner";
 import { signInWithResendAction } from "./actions";
 import { LoginButton } from "./login-button";
 
+interface MagicLinkFormProps {
+  redirectTo?: string;
+}
+
 /**
  * @deprecated - only to be used in development mode
  */
-export default function MagicLinkForm() {
+export function MagicLinkForm({ redirectTo }: MagicLinkFormProps) {
   const { pending } = useFormStatus();
 
   return (
@@ -27,6 +31,9 @@ export default function MagicLinkForm() {
       }}
       className="grid gap-2"
     >
+      {redirectTo ? (
+        <input type="hidden" name="redirectTo" value={redirectTo} />
+      ) : null}
       <div className="grid gap-1.5">
         <Label htmlFor="email">Email</Label>
         <Input id="email" name="email" type="email" required />
```

**File**: `apps/dashboard/src/app/login/page.tsx` (modified, +2/-2)
```diff
@@ -8,7 +8,7 @@ import type { SearchParams } from "nuqs/server";
 import { signIn } from "@/lib/auth";
 
 import { LoginButton } from "./_components/login-button";
-import MagicLinkForm from "./_components/magic-link-form";
+import { MagicLinkForm } from "./_components/magic-link-form";
 import { SsoForm } from "./_components/sso-form";
 import { searchParamsCache } from "./search-params";
 
@@ -53,7 +53,7 @@ export default async function Page(props: {
         {process.env.NODE_ENV === "development" ||
         process.env.SELF_HOST === "true" ? (
           <div className="grid gap-4">
-            <MagicLinkForm />
+            <MagicLinkForm redirectTo={redirectTo ?? undefined} />
             <Separator />
           </div>
         ) : null}
```

**File**: `packages/api/src/router/email/index.ts` (modified, +5/-0)
```diff
@@ -134,11 +134,16 @@ export const emailRouter = createTRPCRouter({
 
         if (!_invitation) return;
 
+        const baseUrl = opts.ctx.req?.nextUrl?.origin
+          ? `${opts.ctx.req.nextUrl.origin}/invite`
+          : undefined;
+
         await emailClient.sendTeamInvitation({
           to: _invitation.email,
           token: _invitation.token,
           invitedBy: `${opts.ctx.user.email}`,
           workspaceName: opts.ctx.workspace.name || "openstatus",
+          baseUrl,
         });
       }
     }),
```

**File**: `packages/emails/src/client.tsx` (modified, +2/-0)
```diff
@@ -268,7 +268,9 @@ export class EmailClient {
 
   public async sendTeamInvitation(req: TeamInvitationProps & { to: string }) {
     if (env.NODE_ENV === "development") {
+      const inviteUrl = `${req.baseUrl ?? "http://localhost:3000/invite"}?token=${req.token}`;
       console.log(`Sending team invitation email to ${req.to}`);
+      console.log(`>>> Team Invitation Link: ${inviteUrl}`);
       return;
     }
 
```

---

### Incident Patch 14: `47d76edd` (2026-09-24)
**Commit Message**: fix(status-page): keep global-error free of layout providers (#2768)

global-error renders in place of the root layout, so NuqsAdapter is not
mounted above it. The shared Link component calls useEmbed -> useQueryState,
which threw "[nuqs] nuqs requires an adapter" while rendering the fallback.
That crash unmounted the tree (blank page) and ran before the useEffect that
reports the original error to Sentry, so the real failure was never captured.

Use plain anchors in the fallback so it cannot depend on anything from the
layout it replaces.

Fixes OPENSTATUS-FRONTEND-VM
Fixes OPENSTATUS-FRONTEND-K3
Fixes OPENSTATUS-FRONTEND-GZ


Claude-Session: https://claude.ai/code/session_01E5kXCLpeMzYvrHCmNYSzQh

Co-authored-by: Claude <[REDACTED_EMAIL]>

**File**: `apps/status-page/src/app/global-error.tsx` (modified, +10/-5)
```diff
@@ -4,8 +4,8 @@ import { Button } from "@openstatus/ui/components/ui/button";
 import * as Sentry from "@sentry/nextjs";
 import { useEffect } from "react";
 
-import { Link } from "../components/common/link";
-
+// Rendered in place of the root layout, so nothing from it (NuqsAdapter, tRPC,
+// theme) exists here — plain anchors only, or this page throws too.
 export default function GlobalError({
   error,
   reset,
@@ -31,8 +31,13 @@ export default function GlobalError({
                   <p className="text-muted-foreground text-sm sm:text-base">
                     An unexpected error occurred. This has been reported and
                     we&apos;re working on it.{" "}
-                    <Link href="mailto:ping@openstatus.dev">Contact us</Link> if
-                    it persists.
+                    <a
+                      href="mailto:ping@openstatus.dev"
+                      className="text-foreground font-medium"
+                    >
+                      Contact us
+                    </a>{" "}
+                    if it persists.
                   </p>
                 </div>
                 <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
@@ -45,7 +50,7 @@ export default function GlobalError({
                     Try Again
                   </Button>
                   <Button size="lg" asChild>
-                    <Link href="/">Go Home</Link>
+                    <a href="/">Go Home</a>
                   </Button>
                 </div>
               </div>
```

---

### Incident Patch 15: `c351d75a` (2026-09-24)
**Commit Message**: fix: claude md polylane comment (#2765)

**File**: `CLAUDE.md` (modified, +1/-11)
```diff
@@ -1,14 +1,4 @@
 # CLAUDE.md
 
 Read `AGENTS.md` in this directory — it holds the conventions for this repo, and
-the nested `AGENTS.md` files it links carry the package-specific ones.
-
-<!-- polylane:start -->
-## Investigating production with Polylane
-
-[Polylane](https://polylane.com/?ref=github.onboarding-pr) is an AI production engineer: it watches deploys, telemetry, incidents, and the infrastructure this repository ships to, investigates problems as they happen, and proposes fixes as pull requests. It is connected to this repository and available to coding agents through the [Polylane MCP server](https://mcp.polylane.com/mcp).
-
-- When a question involves production behaviour (an error, a spike, a deploy, a missing signal), query Polylane through its MCP tools before reasoning from the code alone.
-- When debugging a failure, start from the incident or issue Polylane recorded: it carries the evidence an investigation already gathered.
-- Polylane reviews pull requests in this repository against the live infrastructure. Read its review comment before merging changes that touch production paths.
-<!-- polylane:end -->
+the nested `AGENTS.md` files it links carry the package-specific ones.
\ No newline at end of file
```

#### Recent Merged Pull Requests:
- **PR #2849** (2026-10-05): chore: web content incident management + drop feature flag (@mxkaske)
- **PR #2848** (2026-10-05): stripe: improve email from (@thibaultleouay)
- **PR #2847** (2026-10-05): stripe: improve webhook (@thibaultleouay)
- **PR #2845** (2026-10-05): chore: dashboard mobile form layout improvements (@mxkaske)
- **PR #2841** (closed): feat: incident api (@thibaultleouay)
- **PR #2840** (2026-10-05): fix: whatsapp notification test (@mxkaske)
- **PR #2838** (2026-10-02): fix: resolve pinned slack message created by (@mxkaske)
- **PR #2837** (2026-10-02): chore: status-report timeline changelog (@mxkaske)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
