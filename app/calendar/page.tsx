import { PageHeader } from "@/components/page-header";
import { CalendarClient } from "./calendar-client";
import { QueueList } from "./queue-list";

export default function CalendarPage() {
  return (
    <div className="flex-1">
      <PageHeader
        title="Calendar"
        description="Every queued post, updated after each batch"
      />
      <QueueList days={14} />
      <CalendarClient />
    </div>
  );
}
