import AttendanceImportModal from "@/components/admin/AttendanceImportModal";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  BookOpen,
  ClipboardList,
  Users,
  LogOut,
  Plus,
  Clock,
  FileSpreadsheet,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import eauLogo from "@/assets/eau-logo.png";
import {
  getSemestersApi,
  getOfferingsApi,
  getOfferingStudentsApi,
  getOfferingSummaryApi,
  submitAttendanceApi,
} from "@/api/axios";

interface Semester {
  id: number;
  label: string;
  number: number;
  is_current: boolean;
}
interface Offering {
  id: number;
  course_name: string;
  course_code: string;
  total_credit_hours: string;
  section_name: string;
  section_year: number;
  programme_name: string;
  teacher_name: string;
  semester_label: string;
}
interface Student {
  id: number;
  full_name: string;
  student_id: string;
}

type AttendanceStatus = "present" | "late" | "excused" | "absent";

const statusLabels: Record<AttendanceStatus, string> = {
  present: "Present",
  late: "Late",
  excused: "Excused",
  absent: "Absent",
};

// Sort any student list alphabetically by full_name
const sortAlpha = (list: Student[]) =>
  [...list].sort((a, b) => a.full_name.localeCompare(b.full_name));

const TeacherDashboard = () => {
  const { signOut, user } = useAuth();

  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [selectedSemester, setSelectedSemester] = useState("");

  const [myOfferings, setMyOfferings] = useState<Offering[]>([]);
  const [selectedOffering, setSelectedOffering] = useState("");
  const [loadingOfferings, setLoadingOfferings] = useState(false);

  const [students, setStudents] = useState<Student[]>([]);
  const [summary, setSummary] = useState<any[]>([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [attendanceDate, setAttendanceDate] = useState(
    format(new Date(), "yyyy-MM-dd"),
  );
  const [sessionHours, setSessionHours] = useState("1.5");
  const [sessionType, setSessionType] = useState("theory");
  const [attendanceMap, setAttendanceMap] = useState<
    Record<number, AttendanceStatus>
  >({});
  const [commentMap, setCommentMap] = useState<Record<number, string>>({});
  const [shortName, setShortName] = useState(false);
  const [liveTime, setLiveTime] = useState(
    format(new Date(), "hh:mm:ss aa").toUpperCase(),
  );

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => {
      setLiveTime(format(new Date(), "hh:mm:ss aa").toUpperCase());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Load semesters on mount, auto-select current
  useEffect(() => {
    getSemestersApi().then((res) => {
      const sems = res.data || [];
      setSemesters(sems);
      const current = sems.find((s: Semester) => s.is_current);
      if (current) setSelectedSemester(String(current.id));
    });
  }, []);

  // When semester changes — load this teacher's offerings
  useEffect(() => {
    if (!selectedSemester) return;
    setLoadingOfferings(true);
    setMyOfferings([]);
    setSelectedOffering("");
    setStudents([]);
    setSummary([]);
    getOfferingsApi({ semester: parseInt(selectedSemester) })
      .then((res) => setMyOfferings(res.data || []))
      .catch(() => setMyOfferings([]))
      .finally(() => setLoadingOfferings(false));
  }, [selectedSemester]);

  // When offering selected — load students and summary, both sorted alphabetically
  useEffect(() => {
    if (!selectedOffering) return;
    const offeringId = parseInt(selectedOffering);
    Promise.all([
      getOfferingStudentsApi(offeringId),
      getOfferingSummaryApi(offeringId),
    ]).then(([studRes, sumRes]) => {
      const studentList = sortAlpha(studRes.data.students || []);
      setStudents(studentList);

      // Sort summary rows alphabetically by student name
      const summaryList = [...(sumRes.data.summary || [])].sort((a: any, b: any) =>
        a.student.full_name.localeCompare(b.student.full_name),
      );
      setSummary(summaryList);

      // Default everyone to "present" in attendance map
      const defaults: Record<number, AttendanceStatus> = {};
      studentList.forEach((s: Student) => {
        defaults[s.id] = "present";
      });
      setAttendanceMap(defaults);
      setCommentMap({});
    });
  }, [selectedOffering]);

  const currentOffering = myOfferings.find(
    (o) => o.id === parseInt(selectedOffering),
  );

  const getDisplayName = (name: string) => {
    if (!shortName) return name;
    const parts = name.split(" ");
    return parts.length > 1 ? `${parts[0]} ${parts[1].charAt(0)}.` : name;
  };

  const handleSubmit = async () => {
    if (!selectedOffering) return;
    setSubmitting(true);
    try {
      const records = students.map((s) => ({
        student_id: s.id,
        status: attendanceMap[s.id] || "present",
        comment: commentMap[s.id] || "",
      }));
      await submitAttendanceApi({
        course_offering_id: parseInt(selectedOffering),
        date: attendanceDate,
        session_type: sessionType,
        session_hours: parseFloat(sessionHours),
        records,
      });
      toast.success("Attendance submitted successfully!");
      setDialogOpen(false);
      // Refresh summary after submit, keep alphabetical order
      const sumRes = await getOfferingSummaryApi(parseInt(selectedOffering));
      const summaryList = [...(sumRes.data.summary || [])].sort((a: any, b: any) =>
        a.student.full_name.localeCompare(b.student.full_name),
      );
      setSummary(summaryList);
    } catch (err: any) {
      const detail =
        err?.response?.data?.error ??
        err?.response?.data?.detail ??
        (typeof err?.response?.data === "string" ? err.response.data : null) ??
        err?.message ??
        "Unknown error";
      toast.error(`Failed to submit attendance. ${detail}`);
    } finally {
      setSubmitting(false);
    }
  };

  const isReadyToLog = selectedOffering && students.length > 0;

  // Build a summary lookup by student id for quick access
  const summaryById: Record<number, any> = {};
  summary.forEach((row: any) => {
    summaryById[row.student.id] = row;
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-card border-b border-border px-4 lg:px-6 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={eauLogo} alt="EAU" className="h-8 object-contain" />
          <h1 className="font-display text-base font-bold">Teacher Portal</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground hidden sm:block">
            {user?.first_name} {user?.last_name}
          </span>
          <Button variant="ghost" size="sm" onClick={signOut} className="gap-1.5">
            <LogOut className="w-4 h-4" /> Sign Out
          </Button>
        </div>
      </header>

      <main className="p-3 lg:p-4 max-w-6xl mx-auto space-y-4">
        {/* Semester + Course selector */}
        <Card className="shadow-card border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-base">Select Class</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Semester
                </p>
                <Select value={selectedSemester} onValueChange={setSelectedSemester}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select semester" />
                  </SelectTrigger>
                  <SelectContent>
                    {semesters.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.label} {s.is_current ? "✓" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Your Assigned Course
                </p>
                <Select
                  value={selectedOffering}
                  onValueChange={setSelectedOffering}
                  disabled={!selectedSemester || loadingOfferings}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        loadingOfferings
                          ? "Loading your courses..."
                          : myOfferings.length === 0 && selectedSemester
                            ? "No courses assigned this semester"
                            : "Select course"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {myOfferings.map((o) => (
                      <SelectItem key={o.id} value={String(o.id)}>
                        {o.course_name} — {o.programme_name} · Yr {o.section_year} · Sec{" "}
                        {o.section_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {myOfferings.length === 0 && selectedSemester && !loadingOfferings && (
                  <p className="text-xs text-destructive mt-1">
                    No courses assigned to you for this semester. Ask the admin to assign
                    you to a course offering.
                  </p>
                )}
              </div>
            </div>

            {currentOffering && (
              <div className="mt-4 p-3 rounded-lg bg-muted/40 border border-border flex flex-wrap gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground text-xs uppercase tracking-wide">Programme</span>
                  <p className="font-medium">{currentOffering.programme_name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs uppercase tracking-wide">Section</span>
                  <p className="font-medium">
                    Section {currentOffering.section_name} · Year {currentOffering.section_year}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs uppercase tracking-wide">Course Code</span>
                  <p className="font-medium">{currentOffering.course_code || "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs uppercase tracking-wide">Credit Hours</span>
                  <p className="font-medium">{currentOffering.total_credit_hours} hrs</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs uppercase tracking-wide">Semester</span>
                  <p className="font-medium">{currentOffering.semester_label}</p>
                </div>
              </div>
            )}

            {isReadyToLog && (
              <div className="mt-4 flex justify-end">
                <div className="flex gap-2">
                  <Button variant="outline" className="gap-1.5" onClick={() => setImportOpen(true)}>
                    <FileSpreadsheet className="w-4 h-4" /> Import Excel
                  </Button>
                  <Button
                    className="gap-1.5 bg-primary hover:bg-primary/90"
                    onClick={() => setDialogOpen(true)}
                  >
                    <Plus className="w-4 h-4" /> Log Attendance
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stats */}
        {isReadyToLog && currentOffering && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="shadow-card border-border/50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary/10">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-display font-bold">{students.length}</p>
                  <p className="text-xs text-muted-foreground">
                    Section {currentOffering.section_name} Students
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-card border-border/50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-eau-mustard-light">
                  <ClipboardList className="w-5 h-5 text-secondary-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-display font-bold">{summary.length}</p>
                  <p className="text-xs text-muted-foreground">Student Records</p>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-card border-border/50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-eau-crimson-light">
                  <BookOpen className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <p className="text-2xl font-display font-bold">
                    {currentOffering.total_credit_hours}
                  </p>
                  <p className="text-xs text-muted-foreground">Credit Hours</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Student Roster + Attendance Summary — both alphabetical, summary shows ALL students */}
        {isReadyToLog && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Roster */}
            <Card className="shadow-card border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="font-display text-base">Student Roster</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>University ID</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map((s, i) => (
                      <TableRow key={s.id}>
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="font-medium">{s.full_name}</TableCell>
                        <TableCell className="text-muted-foreground text-xs font-mono">
                          {s.student_id}
                        </TableCell>
                      </TableRow>
                    ))}
                    {students.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                          No students found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Attendance Summary — always shows ALL roster students alphabetically */}
            <Card className="shadow-card border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="font-display text-base">Attendance Summary</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Attended</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map((s) => {
                      const row = summaryById[s.id];
                      return (
                        <TableRow key={s.id}>
                          <TableCell className="font-medium text-sm">{s.full_name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {row ? `${row.attended_hours} hrs` : "0 hrs"}
                          </TableCell>
                          <TableCell>
                            {row ? (
                              <Badge
                                variant="outline"
                                className={`text-xs ${
                                  row.status === "safe"
                                    ? "bg-primary/10 text-primary border-primary/30"
                                    : row.status === "warning"
                                      ? "bg-secondary/20 text-secondary-foreground border-secondary/30"
                                      : "bg-destructive/10 text-destructive border-destructive/30"
                                }`}
                              >
                                {row.status === "safe"
                                  ? "Safe"
                                  : row.status === "warning"
                                    ? "Warning"
                                    : "At Risk"}
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="text-xs bg-muted text-muted-foreground border-border"
                              >
                                No data
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {students.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                          No students found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Empty state */}
        {!isReadyToLog && (
          <div className="flex flex-col items-center justify-center py-10 lg:py-16 text-center px-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="relative w-20 h-20 mb-4">
              <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 via-primary/10 to-transparent rounded-2xl rotate-6 pointer-events-none" />
              <div className="absolute inset-0 bg-gradient-to-br from-eau-crimson-light/40 to-eau-mustard-light/40 rounded-2xl -rotate-3 pointer-events-none" />
              <div className="relative flex items-center justify-center w-full h-full bg-card border border-border shadow-sm rounded-[14px] transition-transform hover:scale-105 duration-300">
                <BookOpen className="w-8 h-8 text-primary" strokeWidth={1.5} />
              </div>
            </div>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground mb-2">
              {user?.first_name ? `Welcome, ${user?.first_name}!` : "Welcome to Teacher Portal"}
            </h2>
            <p className="text-muted-foreground text-sm lg:text-base mb-6 max-w-sm">
              Select a semester to see your assigned courses, then pick a course to start logging
              attendance.
            </p>
            <div className="inline-flex items-center gap-2 text-xs lg:text-sm font-medium text-muted-foreground bg-muted/40 backdrop-blur-sm px-4 py-2 rounded-full border border-border/60 shadow-sm">
              <span className="text-foreground/80">Semester</span>
              <span className="text-muted-foreground/40">→</span>
              <span className="text-foreground/80">Your Course</span>
              <span className="text-muted-foreground/40">→</span>
              <span className="text-foreground/80">Log Attendance</span>
            </div>
          </div>
        )}
      </main>

      {/* Log Attendance Modal */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between">
              <div>
                <DialogTitle className="font-display text-xl">Log Attendance</DialogTitle>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {currentOffering?.course_name} — Section {currentOffering?.section_name}
                  {" · "}
                  {currentOffering?.programme_name}
                </p>
              </div>
              <div className="flex items-center gap-1.5 bg-muted px-3 py-1.5 rounded-lg text-sm font-mono">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                {liveTime}
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="flex items-end gap-4 flex-wrap">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Date</p>
                <input
                  type="date"
                  value={attendanceDate}
                  onChange={(e) => setAttendanceDate(e.target.value)}
                  className="border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Session Type
                </p>
                <Select value={sessionType} onValueChange={setSessionType}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="theory">Theory</SelectItem>
                    <SelectItem value="practical">Practical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Session Hours
                </p>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="8"
                  value={sessionHours}
                  onChange={(e) => setSessionHours(e.target.value)}
                  className="w-24 border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="flex items-center gap-2 mb-1 ml-auto">
                <span className="text-sm text-muted-foreground">Short Name</span>
                <button
                  onClick={() => setShortName(!shortName)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${shortName ? "bg-primary" : "bg-muted-foreground/30"}`}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${shortName ? "translate-x-5" : "translate-x-0.5"}`}
                  />
                </button>
              </div>
            </div>

            {/* Attendance table — students in alphabetical order */}
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase">#</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase">Student</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase">ID</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {students.map((student, index) => (
                    <tr key={student.id} className="hover:bg-muted/20">
                      <td className="px-4 py-3 text-muted-foreground">{index + 1}</td>
                      <td className="px-4 py-3 font-medium">{getDisplayName(student.full_name)}</td>
                      <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                        {student.student_id}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5 flex-wrap">
                          {(["present", "late", "excused", "absent"] as AttendanceStatus[]).map(
                            (s) => (
                              <button
                                key={s}
                                onClick={() =>
                                  setAttendanceMap((prev) => ({ ...prev, [student.id]: s }))
                                }
                                className={`transition-all ${
                                  shortName
                                    ? "w-8 h-8 rounded-full flex items-center justify-center p-0 text-sm font-semibold ring-offset-2"
                                    : "px-3 py-1.5 rounded-full text-xs font-semibold border"
                                } ${
                                  attendanceMap[student.id] === s
                                    ? s === "present"
                                      ? shortName
                                        ? "bg-[#22c55e] text-white ring-2 ring-[#22c55e]/30"
                                        : "bg-[#22c55e] text-white border-[#22c55e]"
                                      : s === "late"
                                        ? shortName
                                          ? "bg-[#fef08a] text-[#ca8a04] ring-2 ring-[#fef08a]/50"
                                          : "bg-[#fef08a] text-[#ca8a04] border-[#fde047]"
                                        : s === "excused"
                                          ? shortName
                                            ? "bg-[#64748b] text-white ring-2 ring-[#64748b]/50"
                                            : "bg-[#64748b] text-white border-[#475569]"
                                          : shortName
                                            ? "bg-[#fee2e2] text-[#ef4444] ring-2 ring-[#fca5a5]/50"
                                            : "bg-[#fee2e2] text-[#ef4444] border-[#fca5a5]"
                                    : "bg-background text-muted-foreground border-border hover:bg-muted/50"
                                }`}
                              >
                                {shortName ? statusLabels[s].charAt(0) : statusLabels[s]}
                              </button>
                            ),
                          )}
                        </div>
                        {attendanceMap[student.id] === "excused" && (
                          <input
                            type="text"
                            value={commentMap[student.id] || ""}
                            onChange={(e) =>
                              setCommentMap((prev) => ({ ...prev, [student.id]: e.target.value }))
                            }
                            placeholder="Reason for excused absence…"
                            className="mt-2 w-full h-8 rounded-md border border-input bg-background px-3 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-muted-foreground">
                <span className="text-primary font-medium">{students.length}</span> students in
                Section {currentOffering?.section_name}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="bg-primary hover:bg-primary/90"
                >
                  {submitting ? "Submitting..." : "Submit Attendance"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import Excel Modal */}
      <AttendanceImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        offering={currentOffering}
      />
    </div>
  );
};

export default TeacherDashboard;