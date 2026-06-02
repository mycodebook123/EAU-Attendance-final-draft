import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Bell,
  Mail,
  Shield,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getSettingsApi, updateSettingsApi } from "@/api/axios";

interface Settings {
  email_alerts_enabled: boolean;
  telegram_alerts_enabled: boolean;
  threshold_warnings_enabled: boolean;
  weekly_reports_enabled: boolean;
  at_risk_threshold: string;
  warning_threshold: string;
}

const defaultSettings: Settings = {
  email_alerts_enabled: true,
  telegram_alerts_enabled: false,
  threshold_warnings_enabled: true,
  weekly_reports_enabled: false,
  at_risk_threshold: "85.0",
  warning_threshold: "90.0",
};

// ── Toggle ────────────────────────────────────────────────────────────────────
const Toggle = ({
  enabled,
  onChange,
  disabled,
}: {
  enabled: boolean;
  onChange: () => void;
  disabled?: boolean;
}) => (
  <button
    onClick={onChange}
    disabled={disabled}
    className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
      enabled ? "bg-primary" : "bg-muted-foreground/30"
    }`}
    role="switch"
    aria-checked={enabled}
  >
    <span
      className={`block w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 absolute top-0.5 ${
        enabled ? "translate-x-5" : "translate-x-0.5"
      }`}
    />
  </button>
);

// ── Main Component ────────────────────────────────────────────────────────────
const SettingsTab = () => {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null); // which field is saving
  const [thresholdForm, setThresholdForm] = useState({
    at_risk_threshold: "",
    warning_threshold: "",
  });
  const [thresholdEditing, setThresholdEditing] = useState(false);
  const [thresholdSaving, setThresholdSaving] = useState(false);

  // ── Load settings on mount ──────────────────────────────────────────────────
  useEffect(() => {
    getSettingsApi()
      .then((res) => {
        setSettings(res.data);
        setThresholdForm({
          at_risk_threshold: String(res.data.at_risk_threshold),
          warning_threshold: String(res.data.warning_threshold),
        });
      })
      .catch(() => toast.error("Failed to load settings"))
      .finally(() => setLoading(false));
  }, []);

  // ── Toggle a boolean setting ────────────────────────────────────────────────
  const handleToggle = async (field: keyof Settings) => {
    const newValue = !settings[field];
    // Optimistic update
    setSettings((prev) => ({ ...prev, [field]: newValue }));
    setSaving(field);
    try {
      const res = await updateSettingsApi({ [field]: newValue });
      setSettings(res.data);
      toast.success("Setting updated");
    } catch {
      // Revert on failure
      setSettings((prev) => ({ ...prev, [field]: !newValue }));
      toast.error("Failed to update setting");
    } finally {
      setSaving(null);
    }
  };

  // ── Save threshold values ───────────────────────────────────────────────────
  const handleThresholdSave = async () => {
    const atRisk = parseFloat(thresholdForm.at_risk_threshold);
    const warning = parseFloat(thresholdForm.warning_threshold);
    if (
      isNaN(atRisk) ||
      isNaN(warning) ||
      atRisk < 1 ||
      atRisk > 100 ||
      warning < 1 ||
      warning > 100
    ) {
      toast.error("Thresholds must be between 1 and 100");
      return;
    }
    if (atRisk >= warning) {
      toast.error("At-risk threshold must be lower than warning threshold");
      return;
    }
    setThresholdSaving(true);
    try {
      const res = await updateSettingsApi({
        at_risk_threshold: atRisk.toFixed(1),
        warning_threshold: warning.toFixed(1),
      });
      setSettings(res.data);
      setThresholdForm({
        at_risk_threshold: String(res.data.at_risk_threshold),
        warning_threshold: String(res.data.warning_threshold),
      });
      setThresholdEditing(false);
      toast.success("Thresholds updated");
    } catch {
      toast.error("Failed to update thresholds");
    } finally {
      setThresholdSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Loading settings…</span>
      </div>
    );
  }

  const toggleRows = [
    {
      field: "email_alerts_enabled" as keyof Settings,
      label: "Email alerts for absences",
      desc: "Send email to parent when student is marked absent",
    },
    {
      field: "telegram_alerts_enabled" as keyof Settings,
      label: "Telegram alerts",
      desc: "Send Telegram message to parent when student is absent",
    },
    {
      field: "threshold_warnings_enabled" as keyof Settings,
      label: "Threshold warnings",
      desc: "Alert when a student approaches their absence limit",
    },
    {
      field: "weekly_reports_enabled" as keyof Settings,
      label: "Weekly reports",
      desc: "Auto-generate and email weekly attendance reports",
    },
  ];

  return (
    <div className="space-y-6">
      {/* ── Notification Toggles ── */}
      <Card className="shadow-card border-border/50">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-muted-foreground" />
            <CardTitle className="font-display text-base">
              Notification Settings
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-1">
          {toggleRows.map((row) => (
            <div
              key={row.field}
              className="flex items-center justify-between py-3.5 border-b border-border last:border-0"
            >
              <div className="flex-1 pr-4">
                <p className="font-medium text-sm">{row.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {row.desc}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {saving === row.field && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                )}
                <Toggle
                  enabled={settings[row.field] as boolean}
                  onChange={() => handleToggle(row.field)}
                  disabled={saving !== null}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ── Attendance Thresholds ── */}
      <Card className="shadow-card border-border/50">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-muted-foreground" />
              <CardTitle className="font-display text-base">
                Attendance Thresholds
              </CardTitle>
            </div>
            {!thresholdEditing && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setThresholdForm({
                    at_risk_threshold: String(settings.at_risk_threshold),
                    warning_threshold: String(settings.warning_threshold),
                  });
                  setThresholdEditing(true);
                }}
              >
                Edit
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Percentage of classes a student must attend. Below the warning level
            triggers an alert; below the at-risk level escalates to admin.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {thresholdEditing ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Warning Threshold (%)
                  </p>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    step="0.1"
                    value={thresholdForm.warning_threshold}
                    onChange={(e) =>
                      setThresholdForm((f) => ({
                        ...f,
                        warning_threshold: e.target.value,
                      }))
                    }
                    className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
                  />
                  <p className="text-xs text-muted-foreground">
                    Email/Telegram alert sent to student & parent
                  </p>
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    At-Risk Threshold (%)
                  </p>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    step="0.1"
                    value={thresholdForm.at_risk_threshold}
                    onChange={(e) =>
                      setThresholdForm((f) => ({
                        ...f,
                        at_risk_threshold: e.target.value,
                      }))
                    }
                    className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
                  />
                  <p className="text-xs text-muted-foreground">
                    Escalated alert to student, parent & admin
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setThresholdEditing(false)}
                  disabled={thresholdSaving}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="bg-primary hover:bg-primary/90"
                  onClick={handleThresholdSave}
                  disabled={thresholdSaving}
                >
                  {thresholdSaving ? (
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…
                    </span>
                  ) : (
                    "Save"
                  )}
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                  <div>
                    <p className="font-medium text-sm">Warning Level</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Alert student & parent via email/Telegram
                    </p>
                  </div>
                </div>
                <span className="text-lg font-bold font-display text-amber-600 dark:text-amber-400">
                  {parseFloat(settings.warning_threshold).toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center justify-between p-4 rounded-xl bg-destructive/5 border border-destructive/20">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
                  <div>
                    <p className="font-medium text-sm">At-Risk Level</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Escalate to student, parent & admin
                    </p>
                  </div>
                </div>
                <span className="text-lg font-bold font-display text-destructive">
                  {parseFloat(settings.at_risk_threshold).toFixed(1)}%
                </span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── System Information ── */}
      <Card className="shadow-card border-border/50">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-muted-foreground" />
            <CardTitle className="font-display text-base">
              System Information
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-1">
          {[
            { label: "Institution", value: "Ethiopian Aviation University" },
            { label: "System", value: "SAMS v1.0" },
            { label: "Backend", value: "Django 6.0 + PostgreSQL" },
            { label: "Environment", value: "Development" },
          ].map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between py-2.5 border-b border-border last:border-0"
            >
              <p className="text-sm text-muted-foreground">{item.label}</p>
              <p className="text-sm font-medium">{item.value}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsTab;
