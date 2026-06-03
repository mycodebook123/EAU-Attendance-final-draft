import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  getStudentsApi,
  getAttendanceApi,
  getOfferingsApi,
  getSemestersApi,
} from "@/api/axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  LogOut,
  ClipboardList,
  AlertTriangle,
  CheckCircle,
  Mail,
} from "lucide-react";
import { toast } from "sonner";
import eauLogo from "@/assets/eau-logo.png";

const statusColors: Record<string, string> = {
  present: "bg-[#608B50]/10 text-[#608B50] border-[#608B50]/30",
  late: "bg-yellow-400/20 text-yellow-600 border-yellow-400/30",
  excused: "bg-slate-500/10 text-slate-600 border-slate-500/30",
  unexcused: "bg-red-500/10 text-red-500 border-red-500/30",
};

const statusLabels: Record<string, string> = {
  present: "Present",
  late: "Late",
  excused: "Excused",
  unexcused: "Absent",
};

export default function StudentDashboard() {
  const { signOut, user } = useAuth();
  const [records, setRecords] = useState<any[]>([]);
  const [offerings, setOfferings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const semRes = await getSemestersApi({ current: true });
        const currentSem = semRes.data?.[0];
        const semId = currentSem?.id;

        const [attendanceRes, offeringsRes] = await Promise.all([
          getAttendanceApi(semId ? { semester: semId } : {}),
          getOfferingsApi(semId ? { semester: semId } : {}),
        ]);

        setRecords(attendanceRes.data || []);
        setOfferings(offeringsRes.data || []);
      } catch (error) {
        toast.error("Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        Loading dashboard...
      </div>
    );
  }

  // Calculate stats from records
  const totalRecords = records.length;
  const presentCount = records.filter(
    (r) => r.status === "present" || r.status === "late",
  ).length;
  const overallPct =
    totalRecords > 0 ? Math.round((presentCount / totalRecords) * 100) : 100;
  const isAtRisk = overallPct < 85;

  // Course breakdown from offerings
  const courseBreakdown = offerings.map((o) => {
    const courseRecords = records.filter(
      (r) => r.course_name === o.course_name,
    );
    const absent = courseRecords.filter((r) => r.status === "unexcused").length;
    const total = courseRecords.length;
    const absenceRate = total > 0 ? (absent / total) * 100 : 0;
    return {
      course_name: o.course_name,
      absence_rate: absenceRate,
      absent_hours: courseRecords
        .filter((r) => r.status === "unexcused")
        .reduce(
          (sum: number, r: any) => sum + parseFloat(r.hours_attended || 0),
          0,
        ),
      total_credit_hours: o.total_credit_hours,
      is_critical: absenceRate > 15,
    };
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-card border-b px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <img src={eauLogo} alt="EAU Logo" className="h-8 object-contain" />
          <h1 className="font-semibold text-lg">Student Portal</h1>
        </div>
        <Button variant="ghost" size="sm" onClick={signOut} className="gap-2">
          <LogOut className="w-4 h-4" /> Sign Out
        </Button>
      </header>

      <main className="max-w-6xl mx-auto p-6 space-y-8">
        {/* Welcome */}
        <div>
          <h2 className="text-2xl font-bold">
            Welcome, {user?.first_name} {user?.last_name}
          </h2>
          <p className="text-muted-foreground text-sm mt-1">{user?.email}</p>
        </div>

        {/* Top Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="shadow-sm border-t-4 border-t-primary">
            <CardContent className="p-6 flex items-start gap-4">
              <div className="p-3 rounded-lg bg-primary/10">
                <ClipboardList className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-3xl font-bold">{overallPct}%</p>
                <p className="text-sm font-medium text-muted-foreground">
                  Overall Attendance
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-6 flex items-start gap-4">
              <div className="p-3 rounded-lg bg-blue-100">
                <CheckCircle className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-3xl font-bold">{offerings.length}</p>
                <p className="text-sm font-medium text-muted-foreground">
                  Enrolled Courses
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className={`shadow-sm ${isAtRisk ? "bg-destructive/5" : ""}`}>
            <CardContent className="p-6 flex items-start gap-4">
              <div
                className={`p-3 rounded-lg ${isAtRisk ? "bg-destructive/10" : "bg-muted"}`}
              >
                <AlertTriangle
                  className={`w-6 h-6 ${isAtRisk ? "text-destructive" : "text-muted-foreground"}`}
                />
              </div>
              <div>
                <p
                  className={`text-3xl font-bold ${isAtRisk ? "text-destructive" : ""}`}
                >
                  {isAtRisk ? "At Risk" : "Good"}
                </p>
                <p className="text-sm font-medium text-muted-foreground">
                  Status
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Course Breakdown */}
        {courseBreakdown.length > 0 && (
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">
                Course Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {courseBreakdown.map((course, idx) => {
                const attendanceRate = Math.max(0, 100 - course.absence_rate);
                return (
                  <div key={idx} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <p className="text-sm font-medium">
                        {course.course_name}
                      </p>
                      <div className="flex items-center gap-2">
                        {course.is_critical && (
                          <Badge
                            variant="destructive"
                            className="text-[10px] uppercase font-bold tracking-wider"
                          >
                            Critical
                          </Badge>
                        )}
                        <span className="text-sm font-bold">
                          {attendanceRate.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${course.is_critical ? "bg-destructive" : "bg-primary"}`}
                        style={{ width: `${attendanceRate}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {course.absent_hours.toFixed(1)} absent hrs ·{" "}
                      {course.absence_rate.toFixed(1)}% absence rate
                    </p>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Recent Attendance */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="shadow-sm lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">
                Recent Attendance
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {records.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  No attendance records yet.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Course</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.slice(0, 20).map((r, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="text-sm py-3">{r.date}</TableCell>
                        <TableCell className="text-sm font-medium py-3">
                          {r.course_name}
                        </TableCell>
                        <TableCell className="py-3">
                          <Badge
                            variant="outline"
                            className={`text-xs font-semibold px-2.5 py-0.5 ${statusColors[r.status] || ""}`}
                          >
                            {statusLabels[r.status] || r.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm h-fit">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold">
                Attendance Policy
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {[
                {
                  color: "bg-primary",
                  label: "Present",
                  desc: "Student attended the required session.",
                },
                {
                  color: "bg-muted-foreground",
                  label: "Excused",
                  desc: "Documented medical or emergency reason.",
                },
                {
                  color: "bg-yellow-400",
                  label: "Late",
                  desc: "Recorded as late. May have consequences.",
                },
                {
                  color: "bg-destructive",
                  label: "Absent",
                  desc: "Negatively impacts your attendance rate.",
                },
              ].map(({ color, label, desc }) => (
                <div key={label} className="flex gap-3">
                  <div
                    className={`mt-1 flex-shrink-0 w-3 h-3 rounded-full ${color}`}
                  />
                  <div>
                    <p className="text-sm font-bold">{label}</p>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {desc}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
