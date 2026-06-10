import { PageHeader } from "@/components/page-header";
import { FbGroupsClient } from "./fb-groups-client";

export default function FbGroupsPage() {
  return (
    <div className="flex-1">
      <PageHeader
        title="FB Groups"
        description="Modern Tradie — posting schedule & pipeline"
      />
      <FbGroupsClient />
    </div>
  );
}
