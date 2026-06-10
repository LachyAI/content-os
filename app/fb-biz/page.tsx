import { PageHeader } from "@/components/page-header";
import { FbBizClient } from "./fb-biz-client";

export default function FbBizPage() {
  return (
    <div className="flex-1">
      <PageHeader
        title="FB Biz Page"
        description="Facebook business page — posting schedule & pipeline"
      />
      <FbBizClient />
    </div>
  );
}
