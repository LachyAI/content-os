import { PageHeader } from "@/components/page-header";
import { FbPersonalClient } from "./fb-personal-client";

export default function FbPersonalPage() {
  return (
    <div className="flex-1">
      <PageHeader
        title="FB Personal"
        description="Personal Facebook — posting schedule & pipeline"
      />
      <FbPersonalClient />
    </div>
  );
}
