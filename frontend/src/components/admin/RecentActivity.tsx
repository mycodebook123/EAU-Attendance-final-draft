import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock } from "lucide-react";

// Notification type defined locally — no import from AdminDashboard
interface Notification {
  id: number;
  message: string;
  notification_type: string;
  created_at: string;
}

interface RecentActivityProps {
  notifications: Notification[];
}

const dotColors: Record<string, string> = {
  absence: "bg-destructive",
  threshold: "bg-amber-500",
  info: "bg-primary",
};

const typeLabel: Record<string, string> = {
  absence: "Absence recorded",
  threshold: "Threshold warning",
  info: "System notification",
};

const formatTime = (iso: string) => {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  return date.toLocaleDateString([], { day: "numeric", month: "short" });
};

const RecentActivity = ({ notifications }: RecentActivityProps) => {
  const activities = notifications.slice(0, 5);

  return (
    <Card className="shadow-card border-border/50 animate-fade-in">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <CardTitle className="font-display text-base">Recent Activity</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <div className="py-8 text-center">
            <Clock className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No recent activity</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Activity will appear here as attendance is recorded
            </p>
          </div>
        ) : (
          <div className="space-y-0">
            {activities.map((n, i) => (
              <div key={n.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-2 h-2 rounded-full mt-2 shrink-0 ${
                      dotColors[n.notification_type] ?? "bg-primary"
                    }`}
                  />
                  {i < activities.length - 1 && (
                    <div className="w-px flex-1 bg-border mt-1" />
                  )}
                </div>
                <div className="pb-4 min-w-0">
                  <p className="text-sm font-medium">
                    {typeLabel[n.notification_type] ?? "Notification"}
                  </p>
                  <p className="text-xs text-muted-foreground leading-snug mt-0.5 line-clamp-2">
                    {n.message}
                  </p>
                  <p className="text-xs text-muted-foreground/50 mt-1">
                    {formatTime(n.created_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RecentActivity;