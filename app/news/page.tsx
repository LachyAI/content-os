import { PageHeader } from "@/components/page-header";
import { NewsClient } from "./news-client";

export default function NewsPage() {
  return (
    <div className="flex-1">
      <PageHeader
        title="News"
        description="AI and creator industry feed"
      />
      <NewsClient />
    </div>
  );
}
