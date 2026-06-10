import { PageHeader } from "@/components/page-header";
import { XThreadsClient } from "./x-threads-client";

export default function XThreadsPage() {
  return (
    <div className="flex-1">
      <PageHeader
        title="X / Threads"
        description="Turn rough ideas into sharp posts — 3 formats per idea"
      />
      <XThreadsClient />
    </div>
  );
}
