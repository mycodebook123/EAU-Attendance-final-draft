import { useEffect, useState, useRef } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getProgrammesApi,
  getSectionsApi,
  getSemestersApi,
  getOfferingsApi,
  getAttendanceApi,
} from "@/api/axios";
import { format, startOfWeek, endOfWeek, subWeeks } from "date-fns";

interface Programme {
  id: number;
  name: string;
  duration_years: number;
}
interface Section {
  id: number;
  name: string;
  year: number;
}
interface Semester {
  id: number;
  label: string;
  is_current: boolean;
}

// ── Status colours (match the bars) ──────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  Present: "hsl(var(--primary))",
  Late: "hsl(var(--secondary))",
  Excused: "#94a3b8",
  Absent: "hsl(var(--destructive))",
};

// ── Drill-down modal ──────────────────────────────────────────────────────────
interface DrillDownStudent {
  student_name: string;
  student_id: string;
  date: string;
}

interface DrillDownState {
  courseName: string;
  status: string;
  students: DrillDownStudent[];
}

const DrillDownModal = ({
  state,
  onClose,
}: {
  state: DrillDownState;
  onClose: () => void;
}) => (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
    onClick={onClose}
  >
    <div
      className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div>
          <h3 className="font-semibold text-sm">{state.courseName}</h3>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span
              className="w-2.5 h-2.5 rounded-full inline-block"
              style={{ backgroundColor: STATUS_COLORS[state.status] }}
            />
            <span className="text-xs text-muted-foreground">
              {state.status} — {state.students.length} student
              {state.students.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground text-xl font-bold leading-none transition-colors"
        >
          ×
        </button>
      </div>

      {/* Body */}
      <div className="overflow-y-auto flex-1 px-5 py-3">
        {state.students.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground text-sm">
            No students with this status in the selected period.
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-left py-2 pr-3 font-medium">#</th>
                <th className="text-left py-2 pr-3 font-medium">Student</th>
                <th className="text-left py-2 pr-3 font-medium">ID</th>
                <th className="text-left py-2 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {state.students.map((s, i) => (
                <tr
                  key={i}
                  className="border-b border-border/50 last:border-0 hover:bg-muted/40 transition-colors"
                >
                  <td className="py-2 pr-3 text-muted-foreground">{i + 1}</td>
                  <td className="py-2 pr-3 font-medium">{s.student_name}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{s.student_id}</td>
                  <td className="py-2 text-muted-foreground">{s.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  </div>
);

// ── Main component ────────────────────────────────────────────────────────────
const AttendanceChart = () => {
  const [chartData, setChartData] = useState<any[]>([]);
  // rawRecords: offeringId → attendance records (kept for drill-down)
  const [rawRecords, setRawRecords] = useState<Record<number, any[]>>({});
  const [loading, setLoading] = useState(false);
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [filterProgramme, setFilterProgramme] = useState("");
  const [filterSection, setFilterSection] = useState("");
  const [filterSemester, setFilterSemester] = useState("");
  const [years, setYears] = useState<number[]>([]);
  const [filterYear, setFilterYear] = useState("1");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const [drillDown, setDrillDown] = useState<DrillDownState | null>(null);

  const [startDate, setStartDate] = useState(
    format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd"),
  );
  const [endDate, setEndDate] = useState(
    format(endOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd"),
  );

  // Close picker on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowDatePicker(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    Promise.all([getProgrammesApi(), getSemestersApi()]).then(
      ([progRes, semRes]) => {
        setProgrammes(progRes.data);
        if (progRes.data.length > 0)
          setFilterProgramme(String(progRes.data[0].id));
        const sems = semRes.data || [];
        setSemesters(sems);
        const current = sems.find((s: Semester) => s.is_current);
        if (current) setFilterSemester(String(current.id));
      },
    );
  }, []);

  useEffect(() => {
    if (!filterProgramme) return;
    const prog = programmes.find((p) => p.id === parseInt(filterProgramme));
    if (prog)
      setYears(Array.from({ length: prog.duration_years }, (_, i) => i + 1));
    if (!filterSemester) return;
    getSectionsApi({
      programme: parseInt(filterProgramme),
      year: parseInt(filterYear),
      semester: parseInt(filterSemester),
    }).then((res) => {
      setSections(res.data);
      setFilterSection("");
    });
  }, [filterProgramme, filterYear, filterSemester]);

  useEffect(() => {
    if (!filterProgramme || !filterSemester) return;
    fetchChartData();
  }, [
    filterProgramme,
    filterYear,
    filterSection,
    filterSemester,
    startDate,
    endDate,
  ]);

  const fetchChartData = async () => {
    setLoading(true);
    try {
      const offeringParams: any = {
        semester: filterSemester,
        programme: filterProgramme,
      };
      if (filterSection) offeringParams.section = filterSection;

      const offeringsRes = await getOfferingsApi(offeringParams);
      const offerings = offeringsRes.data
        .filter(
          (o: any) => !filterYear || o.section_year === parseInt(filterYear),
        )
        .slice(0, 8);

      const recordsMap: Record<number, any[]> = {};

      const data = await Promise.all(
        offerings.map(async (offering: any) => {
          const attendanceRes = await getAttendanceApi({
            offering: offering.id,
          });
          const records = attendanceRes.data.filter((r: any) => {
            const d = String(r.date).substring(0, 10);
            return d >= startDate && d <= endDate;
          });

          // Keep raw records for drill-down
          recordsMap[offering.id] = records;

          const present = records.filter((r: any) => r.status === "present").length;
          const late = records.filter((r: any) => r.status === "late").length;
          const excused = records.filter((r: any) => r.status === "excused").length;
          const absent = records.filter((r: any) => r.status === "absent").length;

          return {
            name:
              offering.course_name.length > 12
                ? offering.course_name.substring(0, 12) + "..."
                : offering.course_name,
            fullName: offering.course_name,
            offeringId: offering.id,
            Present: present,
            Late: late,
            Excused: excused,
            Absent: absent,
          };
        }),
      );

      setRawRecords(recordsMap);
      setChartData(
        data.filter((d) => d.Present + d.Late + d.Excused + d.Absent > 0),
      );
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // ── Drill-down: called when a bar segment is clicked ─────────────────────
  const handleBarClick = (barData: any, statusKey: string) => {
    if (!barData?.offeringId) return;
    const records = rawRecords[barData.offeringId] || [];
    const matching = records
      .filter((r: any) => r.status === statusKey.toLowerCase())
      .map((r: any) => ({
        student_name: r.student_name || r.student || "—",
        student_id: r.student_staff_id || r.student_id || "—",
        date: String(r.date).substring(0, 10),
      }));

    setDrillDown({
      courseName: barData.fullName || barData.name,
      status: statusKey,
      students: matching,
    });
  };

  const setCurrentWeek = () => {
    setStartDate(format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd"));
    setEndDate(format(endOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd"));
    setShowDatePicker(false);
  };

  const setLastWeek = () => {
    const s = startOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 });
    const e = endOfWeek(s, { weekStartsOn: 1 });
    setStartDate(format(s, "yyyy-MM-dd"));
    setEndDate(format(e, "yyyy-MM-dd"));
    setShowDatePicker(false);
  };

  const CustomXAxisTick = ({ x, y, payload }: any) => {
    const [hovered, setHovered] = useState(false);
    const fullName = chartData.find((d) => d.name === payload.value)?.fullName;
    return (
      <g transform={`translate(${x},${y})`}>
        <text
          x={0}
          y={0}
          dy={16}
          textAnchor="middle"
          fill={hovered ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))"}
          fontSize={11}
          style={{ cursor: "pointer", transition: "fill 0.2s" }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          {payload.value}
        </text>
        {hovered && fullName && (
          <g>
            <rect x={-70} y={24} width={140} height={24} rx={4} fill="hsl(var(--foreground))" opacity={0.9} />
            <text x={0} y={40} textAnchor="middle" fill="hsl(var(--background))" fontSize={11} fontWeight={500}>
              {fullName}
            </text>
          </g>
        )}
      </g>
    );
  };

  const fmt = (d: string) => format(new Date(d + "T00:00:00"), "MMM d");
  const dateRangeLabel = `${fmt(startDate)} – ${format(new Date(endDate + "T00:00:00"), "MMM d, yyyy")}`;

  const getPickerStyle = (): React.CSSProperties => {
    if (!pickerRef.current) return { top: 0, right: 0 };
    const rect = pickerRef.current.getBoundingClientRect();
    const pickerHeight = 240;
    const spaceBelow = window.innerHeight - rect.bottom;
    const top = spaceBelow > pickerHeight ? rect.bottom + 8 : rect.top - pickerHeight - 8;
    return { position: "fixed", top, right: window.innerWidth - rect.right, zIndex: 9999 };
  };

  return (
    <>
      {drillDown && (
        <DrillDownModal state={drillDown} onClose={() => setDrillDown(null)} />
      )}

      <Card className="shadow-card border-border/50">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="font-display text-base">
                Attendance Status by Course
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {dateRangeLabel} — click any bar to see students
              </p>
            </div>
            <div className="flex gap-2 flex-wrap items-center">
              <select
                value={filterSemester}
                onChange={(e) => setFilterSemester(e.target.value)}
                className="border border-input rounded-lg px-2 py-1 text-xs bg-background outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">All Semesters</option>
                {semesters.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label} {s.is_current ? "✓" : ""}
                  </option>
                ))}
              </select>

              <select
                value={filterProgramme}
                onChange={(e) => setFilterProgramme(e.target.value)}
                className="border border-input rounded-lg px-2 py-1 text-xs bg-background outline-none focus:ring-2 focus:ring-ring"
              >
                {programmes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name.replace("BSc ", "")}
                  </option>
                ))}
              </select>

              <select
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
                className="border border-input rounded-lg px-2 py-1 text-xs bg-background outline-none focus:ring-2 focus:ring-ring"
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    Year {y}
                  </option>
                ))}
              </select>

              <select
                value={filterSection}
                onChange={(e) => setFilterSection(e.target.value)}
                className="border border-input rounded-lg px-2 py-1 text-xs bg-background outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">All Sections</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    Section {s.name}
                  </option>
                ))}
              </select>

              <div className="relative" ref={pickerRef}>
                <button
                  onClick={() => setShowDatePicker(!showDatePicker)}
                  className="flex items-center gap-1.5 border border-input rounded-lg px-2 py-1 text-xs bg-background hover:bg-muted transition-colors"
                >
                  📅 {dateRangeLabel}
                </button>

                {showDatePicker && (
                  <div
                    className="bg-card border border-border rounded-xl shadow-xl p-4 w-72"
                    style={getPickerStyle()}
                  >
                    <div className="flex gap-2 mb-3">
                      <button
                        onClick={setCurrentWeek}
                        className="flex-1 text-xs py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-medium"
                      >
                        This Week
                      </button>
                      <button
                        onClick={setLastWeek}
                        className="flex-1 text-xs py-1.5 rounded-lg bg-muted hover:bg-muted/80 transition-colors font-medium"
                      >
                        Last Week
                      </button>
                    </div>
                    <div className="space-y-2">
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">From</p>
                        <input
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="w-full border border-input rounded-lg px-3 py-1.5 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">To</p>
                        <input
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="w-full border border-input rounded-lg px-3 py-1.5 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                      <button
                        onClick={() => setShowDatePicker(false)}
                        className="w-full mt-1 text-xs py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium"
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
              Loading chart...
            </div>
          ) : chartData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
              No attendance data for selected period
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart
                data={chartData}
                margin={{ top: 5, right: 10, left: -20, bottom: 40 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="name"
                  tick={(props) => <CustomXAxisTick {...props} />}
                  interval={0}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
                  formatter={(value: any, name: string) => [
                    `${value} student${value !== 1 ? "s" : ""} — click to view`,
                    name,
                  ]}
                />
                <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "32px" }} />
                <Bar
                  dataKey="Present"
                  fill="hsl(var(--primary))"
                  radius={[4, 4, 0, 0]}
                  style={{ cursor: "pointer" }}
                  onClick={(data) => handleBarClick(data, "Present")}
                />
                <Bar
                  dataKey="Late"
                  fill="hsl(var(--secondary))"
                  radius={[4, 4, 0, 0]}
                  style={{ cursor: "pointer" }}
                  onClick={(data) => handleBarClick(data, "Late")}
                />
                <Bar
                  dataKey="Excused"
                  fill="#94a3b8"
                  radius={[4, 4, 0, 0]}
                  style={{ cursor: "pointer" }}
                  onClick={(data) => handleBarClick(data, "Excused")}
                />
                <Bar
                  dataKey="Absent"
                  fill="hsl(var(--destructive))"
                  radius={[4, 4, 0, 0]}
                  style={{ cursor: "pointer" }}
                  onClick={(data) => handleBarClick(data, "Absent")}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </>
  );
};

export default AttendanceChart;