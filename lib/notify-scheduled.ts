// Fire-and-forget Slack notification when a post first gets a scheduled date.
// Never throws and never awaits — scheduling must not break if Slack is down.

export interface ScheduledNotice {
  board: string;
  title: string;
  date: string;
}

export function notifyScheduled(notice: ScheduledNotice): void {
  if (typeof window === "undefined") return;
  try {
    void fetch("/api/notify-scheduled", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(notice),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // ignore — notifications are best-effort
  }
}
