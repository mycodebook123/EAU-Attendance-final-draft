import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  Download,
  Users,
  BookOpen,
  BarChart2,
  Search,
  ChevronLeft,
  ChevronRight,
  Filter,
  Calendar,
} from "lucide-react";
import {
  downloadReportApi,
  downloadSummaryReportApi,
  getDepartmentsApi,
  getOfferingsApi,
  getOfferingStudentsApi,
  getOfferingSummaryApi,
  getProgrammesApi,
  getSummaryReportApi,
  getSemestersApi,
  getUsersApi,
} from "@/api/axios";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { useAuth } from "@/hooks/useAuth";

interface Course {
  id: number;
  name: string;
}

interface Offering {
  id: number;
  course_name: string;
  section_name: string;
  section_year: number;
  programme_name: string;
  semester_label: string;
}

interface StudentOption {
  id: number;
  full_name: string;
  student_id: string;
}

interface SummaryRow {
  student_pk: number;
  student_id: string;
  full_name: string;
  present_hours: number;
  late_hours: number;
  excused_hours: number;
  absent_hours: number;
  attended_hours: number;
  percentage: number;
  minimum_required: number;
  status: "Safe" | "Warning" | "At Risk";
  excused_reason?: string;
}

interface ReportsTabProps {
  courses: Course[];
}

function getMondayOf(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  return monday;
}

function formatDateISO(d: Date): string {
  return d.toISOString().split("T")[0];
}

function formatWeekLabel(monday: Date): string {
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${monday.toLocaleDateString("en-US", opts)} – ${sunday.toLocaleDateString("en-US", { ...opts, year: "numeric" })}`;
}

const STATUS_COLORS: Record<string, string> = {
  Safe: "text-green-600 bg-green-50 border-green-200",
  Warning: "text-amber-600 bg-amber-50 border-amber-200",
  "At Risk": "text-red-600 bg-red-50 border-red-200",
};

const ReportsTab = ({ courses }: ReportsTabProps) => {
  const { user, role } = useAuth();

  // Is this user a scoped role (not full admin)?
  const isScoped = role === "dean" || role === "dept_head";
  const scopedProgrammeId = isScoped ? (user as any)?.managed_programme : null;

  const [activeReportTab, setActiveReportTab] = useState<
    "student" | "course" | "summary"
  >("student");
  const [selectedOffering, setSelectedOffering] = useState<string>("");
  const [selectedStudent, setSelectedStudent] = useState<string>("all");
  const [reportType, setReportType] = useState<"full" | "weekly" | "custom">("full");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [currentWeekMonday, setCurrentWeekMonday] = useState<Date>(() =>
    getMondayOf(new Date()),
  );

  const [studentSearch, setStudentSearch] = useState("");
  const [downloading, setDownloading] = useState<string | null>(null);
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [offeringStudents, setOfferingStudents] = useState<StudentOption[]>([]);
  const [previewRows, setPreviewRows] = useState<SummaryRow[]>([]);
  const [previewAggregates, setPreviewAggregates] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [loadingOfferings, setLoadingOfferings] = useState(false);
  const [summarySemesters, setSummarySemesters] = useState<
    { id: number; label: string; is_current?: boolean }[]
  >([]);
  const [summaryFilters, setSummaryFilters] = useState({
    semester: "",
    programme: isScoped && scopedProgrammeId ? String(scopedProgrammeId) : "all",
    department: "all",
    teacher: "all",
    start_date: "",
    end_date: "",
  });
  const [programmes, setProgrammes] = useState<{ id: number; name: string }[]>([]);
  const [departments, setDepartments] = useState<{ id: number; name: string }[]>([]);
  const [teachers, setTeachers] = useState<{ id: number; full_name: string }[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryData, setSummaryData] = useState<any>(null);

  const weekStartISO = formatDateISO(currentWeekMonday);
  const weekEnd = new Date(currentWeekMonday);
  weekEnd.setDate(currentWeekMonday.getDate() + 6);
  const weekEndISO = formatDateISO(weekEnd);

  // Load offerings (backend already scopes these by role)
  useEffect(() => {
    const loadOfferings = async () => {
      setLoadingOfferings(true);
      try {
        const semRes = await getSemestersApi({ current: true });
        const currentSem = semRes.data?.[0];
        const params = currentSem ? { semester: currentSem.id } : {};
        const res = await getOfferingsApi(params);
        setOfferings(res.data || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingOfferings(false);
      }
    };
    loadOfferings();
  }, []);

  useEffect(() => {
    getSemestersApi()
      .then((res) => {
        const list = res.data || [];
        setSummarySemesters(list);
        const current = list.find((s: any) => s.is_current) || list[0];
        if (current)
          setSummaryFilters((prev) => ({ ...prev, semester: String(current.id) }));
      })
      .catch(() => setSummarySemesters([]));

    // getProgrammesApi is backend-scoped — dean/dept_head only get their programme(s)
    getProgrammesApi({ active_only: true })
      .then((res) => {
        setProgrammes(res.data || []);
        // If scoped and only one programme returned, lock the filter to it
        if (isScoped && res.data?.length === 1) {
          setSummaryFilters((prev) => ({
            ...prev,
            programme: String(res.data[0].id),
          }));
        }
      })
      .catch(() => setProgrammes([]));

    // getUsersApi with role=teacher — backend scopes by programme for dean/dept_head
    getUsersApi({ role: "teacher" })
      .then((res) => setTeachers(res.data || []))
      .catch(() => setTeachers([]));
  }, []);

  useEffect(() => {
    if (summaryFilters.programme === "all") {
      setDepartments([]);
      return;
    }
    getDepartmentsApi({ programme: parseInt(summaryFilters.programme), active_only: true })
      .then((res) => setDepartments(res.data || []))
      .catch(() => setDepartments([]));
  }, [summaryFilters.programme]);

  useEffect(() => {
    const loadStudentsForOffering = async () => {
      if (!selectedOffering) {
        setOfferingStudents([]);
        setSelectedStudent("all");
        setPreviewRows([]);
        setPreviewAggregates(null);
        return;
      }
      try {
        const res = await getOfferingStudentsApi(parseInt(selectedOffering));
        setOfferingStudents(res.data?.students || []);
      } catch (err) {
        setOfferingStudents([]);
      }
    };
    loadStudentsForOffering();
  }, [selectedOffering]);

  const getEffectiveDates = () => {
    if (reportType === "weekly") {
      return { start_date: weekStartISO, end_date: weekEndISO };
    }
    if (reportType === "custom") {
      return { start_date: startDate, end_date: endDate };
    }
    return {};
  };

  const fetchReportPreview = async (includeStudentFilter: boolean) => {
    if (!selectedOffering) {
      toast.error("Please select a course first");
      return;
    }
    if (reportType === "custom" && (!startDate || !endDate)) {
      toast.error("Please provide start and end date for custom filter");
      return;
    }
    setPreviewLoading(true);
    try {
      const params: any = { type: reportType };
      if (includeStudentFilter && selectedStudent !== "all") {
        params.student = parseInt(selectedStudent);
      }
      const dates = getEffectiveDates();
      Object.assign(params, dates);
      const res = await getOfferingSummaryApi(parseInt(selectedOffering), params);
      setPreviewRows(res.data?.rows || []);
      setPreviewAggregates(res.data?.aggregates || null);
    } catch (err) {
      toast.error("Failed to load report preview");
    } finally {
      setPreviewLoading(false);
    }
  };

  useEffect(() => {
    if (
      (activeReportTab === "student" || activeReportTab === "course") &&
      selectedOffering
    ) {
      if (reportType === "custom" && (!startDate || !endDate)) return;
      fetchReportPreview(activeReportTab === "student");
    }
  }, [
    activeReportTab,
    selectedOffering,
    selectedStudent,
    reportType,
    startDate,
    endDate,
    currentWeekMonday,
  ]);

  const handleOfferingReport = async (format: "pdf" | "csv") => {
    if (!selectedOffering) {
      toast.error("Please select a course first");
      return;
    }
    if (reportType === "custom" && (!startDate || !endDate)) {
      toast.error("Please set start and end dates");
      return;
    }
    const key = `${format}-${reportType}`;
    setDownloading(key);
    try {
      const dates = getEffectiveDates();
      const extraParams: any = { ...dates };
      if (activeReportTab === "student" && selectedStudent !== "all") {
        extraParams.student = parseInt(selectedStudent);
      }
      await downloadReportApi("offering", parseInt(selectedOffering), format, reportType === "custom" ? "full" : reportType, extraParams);
      toast.success(`Report downloaded as ${format.toUpperCase()}`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to download report");
    } finally {
      setDownloading(null);
    }
  };

  const filteredStudents = offeringStudents.filter((s) => {
    const q = studentSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      s.full_name.toLowerCase().includes(q) || s.student_id.toLowerCase().includes(q)
    );
  });

  const chartRiskData = previewAggregates?.risk_distribution
    ? Object.entries(previewAggregates.risk_distribution).map(([name, value]) => ({ name, value }))
    : [];
  const chartBandData = previewAggregates?.attendance_bands
    ? Object.entries(previewAggregates.attendance_bands).map(([band, count]) => ({ band, count }))
    : [];

  const fetchSummaryPreview = async () => {
    if (!summaryFilters.semester) {
      toast.error("Please select semester");
      return;
    }
    setSummaryLoading(true);
    try {
      const params: any = { semester: parseInt(summaryFilters.semester) };
      if (summaryFilters.programme !== "all") params.programme = parseInt(summaryFilters.programme);
      if (summaryFilters.department !== "all") params.department = parseInt(summaryFilters.department);
      if (summaryFilters.teacher !== "all") params.teacher = parseInt(summaryFilters.teacher);
      if (summaryFilters.start_date) params.start_date = summaryFilters.start_date;
      if (summaryFilters.end_date) params.end_date = summaryFilters.end_date;
      const res = await getSummaryReportApi(params);
      setSummaryData(res.data);
    } catch (err) {
      toast.error("Failed to load summary analytics");
    } finally {
      setSummaryLoading(false);
    }
  };

  useEffect(() => {
    if (activeReportTab === "summary" && summaryFilters.semester) {
      fetchSummaryPreview();
    }
  }, [activeReportTab, summaryFilters.semester]);

  const reportTabs = [
    { id: "student", label: "By Student", icon: Users },
    { id: "course", label: "By Course", icon: BookOpen },
    { id: "summary", label: "Summary", icon: BarChart2 },
  ];

  const renderOfferingFilterPanel = (showStudentFilter: boolean) => (
    <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Filter className="w-3.5 h-3.5" />
        Filters
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Course
          </label>
          <Select value={selectedOffering} onValueChange={setSelectedOffering}>
            <SelectTrigger>
              <SelectValue placeholder={loadingOfferings ? "Loading…" : "Choose a course…"} />
            </SelectTrigger>
            <SelectContent>
              {offerings.map((o) => (
                <SelectItem key={o.id} value={String(o.id)}>
                  {o.course_name} — Sec {o.section_name} Y{o.section_year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Date Range
          </label>
          <Select
            value={reportType}
            onValueChange={(v) => setReportType(v as "full" | "weekly" | "custom")}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="full">Full semester</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="custom">Custom range</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {reportType === "weekly" && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-background p-3">
          <button
            onClick={() => {
              const prev = new Date(currentWeekMonday);
              prev.setDate(prev.getDate() - 7);
              setCurrentWeekMonday(prev);
            }}
            className="p-1.5 rounded-md hover:bg-muted transition-colors flex-shrink-0"
            title="Previous week"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-0.5">
              Week
            </p>
            <p className="text-sm font-semibold">{formatWeekLabel(currentWeekMonday)}</p>
          </div>
          {/* Jump-to-date button */}
          <div className="relative flex-shrink-0" title="Jump to a specific date">
            <button
              className="p-1.5 rounded-md hover:bg-muted transition-colors flex items-center gap-1 text-xs text-muted-foreground"
              onClick={() => {
                const input = document.getElementById("week-jump-input") as HTMLInputElement;
                if (input) input.showPicker?.();
              }}
            >
              <Calendar className="w-4 h-4" />
            </button>
            <input
              id="week-jump-input"
              type="date"
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              onChange={(e) => {
                if (!e.target.value) return;
                const picked = new Date(e.target.value + "T00:00:00");
                setCurrentWeekMonday(getMondayOf(picked));
              }}
            />
          </div>
          <button
            onClick={() => {
              const next = new Date(currentWeekMonday);
              next.setDate(next.getDate() + 7);
              setCurrentWeekMonday(next);
            }}
            className="p-1.5 rounded-md hover:bg-muted transition-colors flex-shrink-0"
            title="Next week"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {reportType === "custom" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            />
          </div>
        </div>
      )}

      {showStudentFilter && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Student
            </label>
            <Select value={selectedStudent} onValueChange={setSelectedStudent}>
              <SelectTrigger>
                <SelectValue placeholder="All students" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All students</SelectItem>
                {filteredStudents.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.full_name} ({s.student_id})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Search
            </label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
              <input
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                placeholder="Name or ID…"
                className="w-full h-9 rounded-md border border-input bg-background pl-9 pr-3 text-sm"
              />
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border">
        <button
          onClick={() => fetchReportPreview(showStudentFilter)}
          disabled={!selectedOffering || previewLoading}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {previewLoading ? "Loading…" : "Preview"}
        </button>
        <button
          onClick={() => handleOfferingReport("pdf")}
          disabled={!selectedOffering || !!downloading}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border hover:bg-muted text-sm font-medium disabled:opacity-50 transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          PDF
        </button>
        <button
          onClick={() => handleOfferingReport("csv")}
          disabled={!selectedOffering || !!downloading}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border hover:bg-muted text-sm font-medium disabled:opacity-50 transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          Excel
        </button>
        {downloading && (
          <span className="text-xs text-muted-foreground ml-1">Generating…</span>
        )}
      </div>
    </div>
  );

  const renderKPIs = () =>
    previewAggregates ? (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Students", value: previewAggregates.total_students ?? 0 },
          { label: "Average %", value: `${previewAggregates.average_attendance_percentage ?? 0}%` },
          { label: "Warning", value: previewAggregates.warning_count ?? 0, color: "text-amber-600" },
          { label: "At Risk", value: previewAggregates.at_risk_count ?? 0, color: "text-red-600" },
        ].map(({ label, value, color }) => (
          <div key={label} className="p-3 rounded-lg border border-border bg-background">
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className={`text-2xl font-bold tabular-nums ${color ?? ""}`}>{value}</p>
          </div>
        ))}
      </div>
    ) : null;

  const RISK_COLORS = ["#16a34a", "#f59e0b", "#dc2626"];
  const renderCharts = () =>
    previewRows.length > 0 ? (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-background p-4">
          <p className="text-sm font-semibold mb-3">Risk Distribution</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={chartRiskData} dataKey="value" nameKey="name" outerRadius={80} innerRadius={40}>
                  {chartRiskData.map((_, i) => (
                    <Cell key={i} fill={RISK_COLORS[i % RISK_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-background p-4">
          <p className="text-sm font-semibold mb-1">Attendance Bands</p>
          <p className="text-xs text-muted-foreground mb-3">
            Number of students grouped by attendance percentage:&nbsp;
            <span className="text-red-600 font-medium">&lt;75% = At Risk</span>
            {" · "}
            <span className="text-amber-600 font-medium">75–84.9% = Warning</span>
            {" · "}
            <span className="text-blue-600 font-medium">85–89.9% = Near-Safe</span>
            {" · "}
            <span className="text-green-600 font-medium">≥90% = Safe</span>
          </p>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartBandData} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="band" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} label={{ value: "Students", angle: -90, position: "insideLeft", style: { fontSize: 10 } }} />
                <Tooltip
                  formatter={(value: any) => [value, "Students"]}
                  labelFormatter={(label) => `Band: ${label}`}
                />
                <Bar dataKey="count" name="Students" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    ) : null;

  const renderStudentTable = (showPerStudentDownload: boolean) =>
    previewRows.length > 0 ? (
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-xs text-muted-foreground uppercase tracking-wide">
                <th className="p-3 text-left">Student</th>
                <th className="p-3 text-right">Present</th>
                <th className="p-3 text-right">Late</th>
                <th className="p-3 text-right">Excused</th>
                <th className="p-3 text-right">Absent</th>
                <th className="p-3 text-right">Att. %</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-left">Excused Reason</th>
                {showPerStudentDownload && <th className="p-3 text-right">Export</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {previewRows.map((row) => (
                <tr key={row.student_pk} className="hover:bg-muted/30 transition-colors">
                  <td className="p-3">
                    <p className="font-medium">{row.full_name}</p>
                    <p className="text-xs text-muted-foreground">{row.student_id}</p>
                  </td>
                  <td className="p-3 text-right tabular-nums">{row.present_hours}</td>
                  <td className="p-3 text-right tabular-nums">{row.late_hours}</td>
                  <td className="p-3 text-right tabular-nums">{row.excused_hours}</td>
                  <td className="p-3 text-right tabular-nums">{row.absent_hours}</td>
                  <td className="p-3 text-right tabular-nums font-medium">{row.percentage}%</td>
                  <td className="p-3 text-center">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[row.status] ?? ""}`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="p-3 text-left">
                    {row.excused_reason ? (
                      <span className="text-xs text-muted-foreground italic">{row.excused_reason}</span>
                    ) : (
                      <span className="text-muted-foreground/30 text-xs">—</span>
                    )}
                  </td>
                  {showPerStudentDownload && (
                    <td className="p-3">
                      <div className="flex justify-end gap-1.5">
                        {(["pdf", "csv"] as const).map((fmt) => (
                          <button
                            key={fmt}
                            onClick={() => {
                              const dates = getEffectiveDates();
                              downloadReportApi("student", row.student_pk, fmt, reportType === "custom" ? "full" : reportType, {
                                offering: parseInt(selectedOffering),
                                ...dates,
                              });
                            }}
                            className="px-2 py-1 rounded border border-border text-xs hover:bg-muted uppercase transition-colors"
                          >
                            {fmt}
                          </button>
                        ))}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    ) : null;

  const EmptyState = ({ message }: { message: string }) => (
    <div className="text-center py-16 text-muted-foreground border border-dashed border-border rounded-xl">
      <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-25" />
      <p className="text-sm">{message}</p>
    </div>
  );

  return (
    <Card className="shadow-card border-border/50">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-muted-foreground" />
          <CardTitle className="font-display text-base">Reports & Analytics</CardTitle>
        </div>

        <div className="flex gap-1 bg-muted rounded-lg p-1 w-fit mt-3">
          {reportTabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveReportTab(id as any)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                activeReportTab === id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {activeReportTab === "student" && (
          <div className="space-y-5">
            <p className="text-sm text-muted-foreground">
              Filter by course, date range, and individual student — then preview or download.
            </p>
            {renderOfferingFilterPanel(true)}
            {selectedOffering ? (
              <>
                {renderKPIs()}
                {renderCharts()}
                {previewRows.length > 0
                  ? renderStudentTable(true)
                  : !previewLoading && (
                      <EmptyState message="No attendance data for the selected filters." />
                    )}
              </>
            ) : (
              <EmptyState message="Select a course above to preview student reports." />
            )}
          </div>
        )}

        {activeReportTab === "course" && (
          <div className="space-y-5">
            <p className="text-sm text-muted-foreground">
              Preview and download a full course-level attendance report.
            </p>
            {renderOfferingFilterPanel(false)}
            {selectedOffering ? (
              <>
                {renderKPIs()}
                {renderCharts()}
                {previewRows.length > 0
                  ? renderStudentTable(false)
                  : !previewLoading && (
                      <EmptyState message="No attendance data for the selected filters." />
                    )}
              </>
            ) : (
              <EmptyState message="Select a course above to preview the course report." />
            )}
          </div>
        )}

        {activeReportTab === "summary" && (
          <div className="space-y-5">
            <p className="text-sm text-muted-foreground">
              Executive cross-offering analytics — hotspots, rankings, and trends.
            </p>

            <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Filter className="w-3.5 h-3.5" />
                Filters
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Semester</label>
                  <Select
                    value={summaryFilters.semester}
                    onValueChange={(v) => setSummaryFilters((p) => ({ ...p, semester: v }))}
                  >
                    <SelectTrigger><SelectValue placeholder="Select semester" /></SelectTrigger>
                    <SelectContent>
                      {summarySemesters.map((s) => (
                        <SelectItem key={s.id} value={String(s.id)}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Programme</label>
                  <Select
                    value={summaryFilters.programme}
                    onValueChange={(v) => setSummaryFilters((p) => ({ ...p, programme: v, department: "all" }))}
                    disabled={isScoped && programmes.length === 1}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {/* Only show "All programmes" for admin */}
                      {!isScoped && <SelectItem value="all">All programmes</SelectItem>}
                      {programmes.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Department</label>
                  <Select
                    value={summaryFilters.department}
                    onValueChange={(v) => setSummaryFilters((p) => ({ ...p, department: v }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All departments</SelectItem>
                      {departments.map((d) => (
                        <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Teacher</label>
                  <Select
                    value={summaryFilters.teacher}
                    onValueChange={(v) => setSummaryFilters((p) => ({ ...p, teacher: v }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All teachers</SelectItem>
                      {teachers.map((t) => (
                        <SelectItem key={t.id} value={String(t.id)}>{t.full_name || `Teacher ${t.id}`}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">From Date (optional)</label>
                  <input
                    type="date"
                    value={summaryFilters.start_date}
                    onChange={(e) => setSummaryFilters((p) => ({ ...p, start_date: e.target.value }))}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">To Date (optional)</label>
                  <input
                    type="date"
                    value={summaryFilters.end_date}
                    onChange={(e) => setSummaryFilters((p) => ({ ...p, end_date: e.target.value }))}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pt-1 border-t border-border">
                <button
                  onClick={fetchSummaryPreview}
                  disabled={summaryLoading}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {summaryLoading ? "Loading…" : "Preview"}
                </button>
                <button
                  onClick={async () => {
                    try {
                      const p: any = {};
                      if (summaryFilters.semester) p.semester = parseInt(summaryFilters.semester);
                      if (summaryFilters.programme !== "all") p.programme = parseInt(summaryFilters.programme);
                      if (summaryFilters.department !== "all") p.department = parseInt(summaryFilters.department);
                      if (summaryFilters.teacher !== "all") p.teacher = parseInt(summaryFilters.teacher);
                      if (summaryFilters.start_date) p.start_date = summaryFilters.start_date;
                      if (summaryFilters.end_date) p.end_date = summaryFilters.end_date;
                      await downloadSummaryReportApi("pdf", p);
                      toast.success("Summary PDF downloaded");
                    } catch (err: any) {
                      toast.error(err?.message || "Failed to download summary PDF");
                    }
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border hover:bg-muted text-sm font-medium transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Executive PDF
                </button>
                <button
                  onClick={async () => {
                    try {
                      const p: any = {};
                      if (summaryFilters.semester) p.semester = parseInt(summaryFilters.semester);
                      if (summaryFilters.programme !== "all") p.programme = parseInt(summaryFilters.programme);
                      if (summaryFilters.department !== "all") p.department = parseInt(summaryFilters.department);
                      if (summaryFilters.teacher !== "all") p.teacher = parseInt(summaryFilters.teacher);
                      if (summaryFilters.start_date) p.start_date = summaryFilters.start_date;
                      if (summaryFilters.end_date) p.end_date = summaryFilters.end_date;
                      await downloadSummaryReportApi("csv", p);
                      toast.success("Summary CSV downloaded");
                    } catch (err: any) {
                      toast.error(err?.message || "Failed to download summary CSV");
                    }
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border hover:bg-muted text-sm font-medium transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Excel
                </button>
              </div>
            </div>

            {summaryData?.kpis && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {[
                  { label: "Offerings", value: summaryData.kpis.total_offerings },
                  { label: "Students", value: summaryData.kpis.total_students },
                  { label: "Overall Avg %", value: `${summaryData.kpis.overall_average_attendance}%` },
                  { label: "At Risk", value: summaryData.kpis.total_at_risk_students, color: "text-red-600" },
                  { label: "Worst Offering", value: summaryData.kpis.worst_offering_name, small: true },
                ].map(({ label, value, color, small }) => (
                  <div key={label} className="p-3 rounded-lg border border-border bg-background">
                    <p className="text-xs text-muted-foreground mb-1">{label}</p>
                    <p className={`font-bold truncate ${small ? "text-sm mt-1" : "text-2xl tabular-nums"} ${color ?? ""}`}>
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {summaryData && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-xl border border-border bg-background p-4">
                  <p className="text-sm font-semibold mb-3">Risk Distribution</p>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={Object.entries(summaryData.risk_distribution || {}).map(([name, value]) => ({ name, value }))}
                          dataKey="value"
                          nameKey="name"
                          outerRadius={80}
                          innerRadius={40}
                        >
                          {Object.keys(summaryData.risk_distribution || {}).map((_, i) => (
                            <Cell key={i} fill={RISK_COLORS[i % RISK_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-background p-4">
                  <p className="text-sm font-semibold mb-1">Attendance Bands</p>
                  <p className="text-xs text-muted-foreground mb-2">
                    Students grouped by attendance %:&nbsp;
                    <span className="text-red-600 font-medium">&lt;75% At Risk</span>
                    {" · "}
                    <span className="text-amber-600 font-medium">75–84.9% Warning</span>
                    {" · "}
                    <span className="text-blue-600 font-medium">85–89.9% Near-Safe</span>
                    {" · "}
                    <span className="text-green-600 font-medium">≥90% Safe</span>
                  </p>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={(() => {
                          // Aggregate bands from offering_analytics
                          const bandsMap: Record<string, number> = {};
                          (summaryData.offering_analytics || []).forEach((row: any) => {
                            Object.entries(row.attendance_bands || {}).forEach(([k, v]) => {
                              bandsMap[k] = (bandsMap[k] || 0) + (v as number);
                            });
                          });
                          return [
                            { band: "<75%", count: bandsMap["<75%"] || 0 },
                            { band: "75–84.9%", count: bandsMap["75-84.9%"] || 0 },
                            { band: "85–89.9%", count: bandsMap["85-89.9%"] || 0 },
                            { band: "≥90%", count: bandsMap[">=90%"] || 0 },
                          ];
                        })()}
                        barCategoryGap="30%"
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="band" tick={{ fontSize: 10 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 10 }} label={{ value: "Students", angle: -90, position: "insideLeft", style: { fontSize: 10 } }} />
                        <Tooltip formatter={(value: any) => [value, "Students"]} labelFormatter={(l) => `Band: ${l}`} />
                        <Bar dataKey="count" name="Students" fill="#2563eb" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            {summaryData?.top_offerings?.length > 0 && (
              <div className="rounded-xl border border-border bg-background p-4">
                <p className="text-sm font-semibold mb-1">Top vs Bottom Offerings</p>
                <p className="text-xs text-muted-foreground mb-3">Average attendance % by offering — hover for name</p>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[
                        ...(summaryData.top_offerings || []).map((x: any) => ({ name: x.offering_label, avg: x.average_attendance, type: "Top" })),
                        ...(summaryData.bottom_offerings || []).map((x: any) => ({ name: x.offering_label, avg: x.average_attendance, type: "Bottom" })),
                      ]}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" hide />
                      <YAxis tick={{ fontSize: 11 }} label={{ value: "Avg %", angle: -90, position: "insideLeft", style: { fontSize: 10 } }} />
                      <Tooltip formatter={(v: any) => [`${v}%`, "Avg Attendance"]} />
                      <Legend formatter={(v) => v === "avg" ? "Average Attendance %" : v} />
                      <Bar dataKey="avg" name="avg" fill="#2563eb" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {summaryData?.attendance_trend?.length > 0 && (
              <div className="rounded-xl border border-border bg-background p-4">
                <p className="text-sm font-semibold mb-3">Attendance Trend by Week</p>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={summaryData.attendance_trend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} label={{ value: "Avg %", angle: -90, position: "insideLeft", style: { fontSize: 10 } }} />
                      <Tooltip formatter={(v: any) => [`${v}%`, "Avg Attendance"]} />
                      <Bar dataKey="average_attendance" name="Avg Attendance %" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {summaryData?.offering_analytics?.length > 0 && (
              <div className="rounded-xl border border-border overflow-hidden">
                <div className="p-3 border-b border-border">
                  <p className="text-sm font-semibold">At-Risk Hotspots</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 text-xs text-muted-foreground uppercase tracking-wide">
                        <th className="p-3 text-left">Offering</th>
                        <th className="p-3 text-left">Programme</th>
                        <th className="p-3 text-left">Department</th>
                        <th className="p-3 text-right">Students</th>
                        <th className="p-3 text-right">Avg %</th>
                        <th className="p-3 text-right">At Risk</th>
                        <th className="p-3 text-right">Trend</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {summaryData.offering_analytics.map((row: any) => (
                        <tr key={row.offering_id} className="hover:bg-muted/30 transition-colors">
                          <td className="p-3 font-medium">{row.offering_label}</td>
                          <td className="p-3 text-muted-foreground">{row.programme_name}</td>
                          <td className="p-3 text-muted-foreground">{row.department_name}</td>
                          <td className="p-3 text-right tabular-nums">{row.student_count}</td>
                          <td className="p-3 text-right tabular-nums">{row.average_attendance}%</td>
                          <td className="p-3 text-right tabular-nums">
                            <span className={row.at_risk_count > 0 ? "text-red-600 font-medium" : ""}>{row.at_risk_count}</span>
                          </td>
                          <td className="p-3 text-right tabular-nums">
                            <span className={row.trend_delta > 0 ? "text-green-600" : row.trend_delta < 0 ? "text-red-600" : ""}>
                              {row.trend_delta > 0 ? "+" : ""}{row.trend_delta}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {!summaryLoading && !summaryData?.offering_analytics?.length && (
              <EmptyState message="No summary data found for the selected filters." />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ReportsTab;