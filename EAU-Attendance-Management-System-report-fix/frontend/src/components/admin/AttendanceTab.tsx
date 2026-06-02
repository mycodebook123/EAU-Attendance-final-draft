import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { getAttendanceApi, getSectionsApi, getSemestersApi } from "@/api/axios";

interface Course {
  id: number;
  name: string;
  year: number;
}
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

interface AttendanceTabProps {
  courses: Course[];
  programmes: Programme[];
}

const statusStyles: Record<string, string> = {
  present: "bg-primary/10 text-primary border-primary/30",
  late: "bg-secondary/20 text-secondary-foreground border-secondary/30",
  excused: "bg-muted text-muted-foreground border-border",
  unexcused: "bg-destructive/10 text-destructive border-destructive/30",
};

const statusLabels: Record<string, string> = {
  present: "Present",
  late: "Late",
  excused: "Excused",
  unexcused: "Unexcused",
};

const AttendanceTab = ({ courses, programmes }: AttendanceTabProps) => {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [semesters, setSemesters] = useState<Semester[]>([]);

  // Filters
  const [filterSemester, setFilterSemester] = useState("");
  const [filterProgramme, setFilterProgramme] = useState("");
  const [filterSection, setFilterSection] = useState("");
  const [filterCourse, setFilterCourse] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [sections, setSections] = useState<Section[]>([]);

  useEffect(() => {
    getSemestersApi().then((res) => {
      const sems = res.data || [];
      setSemesters(sems);
      // Auto-select current semester
      const current = sems.find((s: Semester) => s.is_current);
      if (current) setFilterSemester(String(current.id));
    });
  }, []);

  // When semester or programme changes — load sections
  useEffect(() => {
    if (!filterSemester) {
      setSections([]);
      setFilterSection("");
      return;
    }
    const params: any = { semester: filterSemester };
    if (filterProgramme) params.programme = filterProgramme;
    getSectionsApi(params).then((res) => setSections(res.data));
    setFilterSection("");
  }, [filterSemester, filterProgramme]);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (filterSemester) params.semester = filterSemester;
      if (filterCourse) params.offering = filterCourse;
      if (filterDate) params.date = filterDate;
      if (filterSection) params.section = filterSection;
      if (filterProgramme) params.programme = filterProgramme;
      if (search) params.search = search;
      const res = await getAttendanceApi(params);
      setRecords(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [
    filterSemester,
    filterCourse,
    filterDate,
    filterSection,
    filterProgramme,
  ]);

  const filtered = records.filter((r) => {
    if (!search) return true;
    return (
      r.student_name?.toLowerCase().includes(search.toLowerCase()) ||
      r.course_name?.toLowerCase().includes(search.toLowerCase()) ||
      r.student_id?.toLowerCase().includes(search.toLowerCase())
    );
  });

  return (
    <Card className="shadow-card border-border/50">
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-3">
          <CardTitle className="font-display text-base">
            Attendance Records
          </CardTitle>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-end">
            <select
              value={filterSemester}
              onChange={(e) => setFilterSemester(e.target.value)}
              className="border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">All Semesters</option>
              {semesters.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label} {s.is_current ? "(Current)" : ""}
                </option>
              ))}
            </select>

            <select
              value={filterProgramme}
              onChange={(e) => setFilterProgramme(e.target.value)}
              className="border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">All Programmes</option>
              {programmes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            <select
              value={filterSection}
              onChange={(e) => setFilterSection(e.target.value)}
              disabled={!filterSemester}
              className="border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            >
              <option value="">All Sections</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  Section {s.name} (Y{s.year})
                </option>
              ))}
            </select>

            <select
              value={filterCourse}
              onChange={(e) => setFilterCourse(e.target.value)}
              className="border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">All Courses</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
            />

            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search student or course..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead className="border-y border-border bg-muted/30">
            <tr>
              <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                Date
              </th>
              <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                Student
              </th>
              <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                Course
              </th>
              <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                Section
              </th>
              <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                Status
              </th>
              <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                Hours
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && (
              <tr>
                <td
                  colSpan={6}
                  className="text-center py-12 text-muted-foreground"
                >
                  Loading records...
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="text-center py-12 text-muted-foreground"
                >
                  No records found. Use filters above to search.
                </td>
              </tr>
            )}
            {filtered.map((r, i) => (
              <tr
                key={`${r.id}-${i}`}
                className="hover:bg-muted/20 transition-colors"
              >
                <td className="px-6 py-4 text-muted-foreground">{r.date}</td>
                <td className="px-6 py-4">
                  <p className="font-medium">{r.student_name}</p>
                  <p className="text-xs text-muted-foreground font-mono">
                    {r.student_id}
                  </p>
                </td>
                <td className="px-6 py-4 text-muted-foreground">
                  {r.course_name}
                </td>
                <td className="px-6 py-4 text-muted-foreground">
                  {r.section_name || "—"}
                </td>
                <td className="px-6 py-4">
                  <Badge
                    variant="outline"
                    className={`text-xs ${statusStyles[r.status] || ""}`}
                  >
                    {statusLabels[r.status] || r.status}
                  </Badge>
                </td>
                <td className="px-6 py-4 text-muted-foreground">
                  {r.hours_attended} hrs
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
};

export default AttendanceTab;
