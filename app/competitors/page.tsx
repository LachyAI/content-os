import { PageHeader } from "@/components/page-header";
import { getCompetitors } from "@/lib/competitor-data";
import { CompetitorsClient } from "./competitors-client";

export default function CompetitorsPage() {
  const competitors = getCompetitors();
  return (
    <div className="flex-1">
      <PageHeader
        title="Competitors"
        description="Track and analyse competitor Instagram content"
      />
      <CompetitorsClient competitors={competitors} />
    </div>
  );
}
