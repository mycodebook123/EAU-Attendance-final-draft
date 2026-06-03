import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell, AlertTriangle, CheckCircle, Info, Send, X } from "lucide-react";
import { toast } from "sonner";

interface Notification {
  id: number;
  message: string;
  notification_type: string;
  created_at: string;
}

interface NotificationsTabProps {
  notifications: Notification[];
  onMarkRead: (id: number) => void;
}

const getIcon = (type: string) => {
  if (type === "threshold") return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
  if (type === "absence") return <AlertTriangle className="w-4 h-4 text-destructive" />;
  return <Info className="w-4 h-4 text-primary" />;
};

const getTimeAgo = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs > 1 ? "s" : ""} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
};

const NotificationsTab = ({ notifications, onMarkRead }: NotificationsTabProps) => {
  const handleMarkAll = () => {
    notifications.forEach((n) => onMarkRead(n.id));
    toast.success("All notifications marked as read");
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-card border-border/50">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-muted-foreground" />
            <CardTitle className="font-display text-base">Notification Center</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {notifications.length > 0 && (
              <button
                onClick={handleMarkAll}
                className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              >
                <CheckCircle className="w-3.5 h-3.5" /> Mark all read
              </button>
            )}
            <button
              onClick={() => toast.info("Bulk warning sent!")}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors"
            >
              <Send className="w-3.5 h-3.5" /> Send Bulk Warning
            </button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {notifications.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">All caught up! No new notifications.</p>
            </div>
          )}
          {notifications.map((n) => (
            <div
              key={n.id}
              className="flex items-start justify-between gap-4 p-4 rounded-xl border border-border hover:bg-muted/20 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">{getIcon(n.notification_type)}</div>
                <div>
                  <p className="text-sm font-medium">{n.message}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {getTimeAgo(n.created_at)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => onMarkRead(n.id)}
                title="Mark as read / dismiss"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors flex-shrink-0 mt-0.5 border border-border rounded px-2 py-1 hover:border-destructive/30 hover:bg-destructive/5"
              >
                <X className="w-3 h-3" /> Dismiss
              </button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Threshold Configuration */}
      <Card className="shadow-card border-border/50">
        <CardHeader className="pb-4">
          <CardTitle className="font-display text-base">Threshold Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/10 border border-secondary/30">
            <div>
              <p className="font-medium text-sm">Warning Level</p>
              <p className="text-xs text-muted-foreground mt-0.5">Alert student via email</p>
            </div>
            <span className="text-lg font-bold font-display text-secondary-foreground">10%</span>
          </div>
          <div className="flex items-center justify-between p-4 rounded-xl bg-destructive/5 border border-destructive/20">
            <div>
              <p className="font-medium text-sm">Critical Level</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Alert student, parent, and admin
              </p>
            </div>
            <span className="text-lg font-bold font-display text-destructive">15%</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default NotificationsTab;