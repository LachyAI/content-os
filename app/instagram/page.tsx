import { PageHeader } from "@/components/page-header";
import { InstagramClient } from "./instagram-client";

export default function InstagramPage() {
  return (
    <div className="flex-1">
      <PageHeader
        title="Instagram Manager"
        description="Plan, script, and track your content pipeline"
      />
      <InstagramClient />
    </div>
  );
}
