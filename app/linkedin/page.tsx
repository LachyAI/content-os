import { PageHeader } from "@/components/page-header"
import { LinkedInClient } from "./linkedin-client"

export default function LinkedInPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="LinkedIn"
        description="Professional content — posting schedule & pipeline"
      />
      <LinkedInClient />
    </div>
  )
}
