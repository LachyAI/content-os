import { PageHeader } from "@/components/page-header";
import { CalendarClient } from "./calendar-client";

export default function CalendarPage() {
  return (
    <div className="flex-1">
      <PageHeader
        title="Calendar"
        description="Schedule and visualise your content plan"
      />
      <CalendarClient />
    </div>
  );
}
