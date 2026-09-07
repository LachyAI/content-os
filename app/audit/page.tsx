import { PageHeader } from "@/components/page-header";
import { AuditClient } from "./audit-client";

export default function AuditPage() {
  return (
    <div className="flex-1">
      <PageHeader
        title="Competitor Audit"
        description="Client vs competitors — GBP, on-page, rankings, actions"
      />
      <AuditClient />
    </div>
  );
}
