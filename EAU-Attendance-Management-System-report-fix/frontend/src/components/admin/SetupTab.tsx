import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus,
  Pencil,
  Trash2,
  ChevronRight,
  CheckCircle,
  Calendar,
  BookOpen,
  Users,
  GraduationCap,
  Layers,
  Building2,
} from "lucide-react";
import { toast } from "sonner";
import {
  getAcademicYearsApi,
  createAcademicYearApi,
  updateAcademicYearApi,
  deleteAcademicYearApi,
  getSemestersApi,
  createSemesterApi,
  updateSemesterApi,
  deleteSemesterApi,
  getProgrammesApi,
  createProgrammeApi,
  updateProgrammeApi,
  deleteProgrammeApi,
  getDepartmentsApi,
  createDepartmentApi,
  updateDepartmentApi,
  deleteDepartmentApi,
  getSectionsApi,
  createSectionApi,
  deleteSectionApi,
  getOfferingsApi,
  createOfferingApi,
  updateOfferingApi,
  deleteOfferingApi,
  getCoursesApi,
  getUsersApi,
  getStudentsApi,
  getEnrollmentsApi,
  createEnrollmentApi,
  deleteEnrollmentApi,
  bulkEnrollApi,
} from "@/api/axios";

interface AcademicYear {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  semester_count: number;
}
interface Semester {
  id: number;
  academic_year: number;
  academic_year_name: string;
  number: number;
  start_date: string;
  end_date: string;
  is_current: boolean;
  label: string;
  section_count: number;
}
interface Programme {
  id: number;
  name: string;
  code: string;
  duration_years: number;
  is_active: boolean;
}
interface Department {
  id: number;
  name: string;
  code: string;
  programme: number;
  programme_name: string;
  is_active: boolean;
  course_count: number;
}
interface Section {
  id: number;
  name: string;
  programme: number;
  programme_name: string;
  year: number;
  semester: number;
  semester_label: string;
  student_count: number;
}
interface Offering {
  id: number;
  course: number;
  course_name: string;
  section: number;
  section_name: string;
  section_year: number;
  programme_name: string;
  teacher: number | null;
  teacher_name: string | null;
  semester_label: string;
}
interface Course {
  id: number;
  name: string;
  programme: number;
  year: number;
}
interface Student {
  id: number;
  full_name: string;
  student_id: string;
  programme_name: string;
}
interface Enrollment {
  id: number;
  student: number;
  student_name: string;
  student_id_number: string;
  section: number;
  status: string;
}
interface User {
  id: number;
  full_name: string;
  role: string;
}

const steps = [
  { id: "years", label: "Academic Years", icon: Calendar },
  { id: "semesters", label: "Semesters", icon: Layers },
  { id: "programmes", label: "Programmes", icon: GraduationCap },
  { id: "departments", label: "Departments", icon: Building2 },
  { id: "sections", label: "Sections", icon: Users },
  { id: "offerings", label: "Course Offerings", icon: BookOpen },
];

const inputCls =
  "w-full border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring";
const labelCls =
  "text-xs font-medium text-muted-foreground uppercase tracking-wide";

const SetupTab = () => {
  const [activeStep, setActiveStep] = useState("years");
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [filterSemester, setFilterSemester] = useState("");
  const [filterProgramme, setFilterProgramme] = useState("");

  useEffect(() => {
    getProgrammesApi().then((r) => setProgrammes(r.data));
    getDepartmentsApi({ active_only: true }).then((r) =>
      setDepartments(r.data),
    );
    getCoursesApi().then((r) => setCourses(r.data));
    getUsersApi({ role: "teacher" }).then((r) => setTeachers(r.data));
    getAcademicYearsApi().then((r) => setYears(r.data));
    getSemestersApi().then((r) => setSemesters(r.data));
  }, []);

  useEffect(() => {
    const p: any = {};
    if (filterSemester) p.semester = filterSemester;
    if (filterProgramme) p.programme = filterProgramme;
    getSectionsApi(p).then((r) => setSections(r.data));
  }, [filterSemester, filterProgramme]);

  useEffect(() => {
    const p: any = {};
    if (filterSemester) p.semester = filterSemester;
    if (filterProgramme) p.programme = filterProgramme;
    getOfferingsApi(p).then((r) => setOfferings(r.data));
  }, [filterSemester, filterProgramme]);

  return (
    <div className="space-y-6">
      <Card className="shadow-card border-border/50">
        <CardContent className="p-4">
          <div className="flex items-center gap-1 flex-wrap">
            {steps.map((step, i) => {
              const Icon = step.icon;
              const isActive = activeStep === step.id;
              return (
                <div key={step.id} className="flex items-center gap-1">
                  <button
                    onClick={() => setActiveStep(step.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
                  >
                    <Icon className="w-4 h-4" />
                    {step.label}
                  </button>
                  {i < steps.length - 1 && (
                    <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {activeStep === "years" && (
        <AcademicYearsPanel years={years} setYears={setYears} />
      )}
      {activeStep === "semesters" && (
        <SemestersPanel
          semesters={semesters}
          setSemesters={setSemesters}
          years={years}
        />
      )}
      {activeStep === "programmes" && (
        <ProgrammesPanel
          programmes={programmes}
          setProgrammes={setProgrammes}
        />
      )}
      {activeStep === "departments" && (
        <DepartmentsPanel
          departments={departments}
          setDepartments={setDepartments}
          programmes={programmes}
        />
      )}
      {activeStep === "sections" && (
        <SectionsPanel
          sections={sections}
          setSections={setSections}
          semesters={semesters}
          programmes={programmes}
          filterSemester={filterSemester}
          setFilterSemester={setFilterSemester}
          filterProgramme={filterProgramme}
          setFilterProgramme={setFilterProgramme}
        />
      )}
      {activeStep === "offerings" && (
        <OfferingsPanel
          offerings={offerings}
          setOfferings={setOfferings}
          sections={sections}
          courses={courses}
          teachers={teachers}
          semesters={semesters}
          programmes={programmes}
          filterSemester={filterSemester}
          setFilterSemester={setFilterSemester}
          filterProgramme={filterProgramme}
          setFilterProgramme={setFilterProgramme}
        />
      )}
    </div>
  );
};

// ─── Academic Years ───────────────────────────────────────────────────────────
const AcademicYearsPanel = ({
  years,
  setYears,
}: {
  years: AcademicYear[];
  setYears: any;
}) => {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AcademicYear | null>(null);
  const [form, setForm] = useState({
    name: "",
    start_date: "",
    end_date: "",
    is_current: false,
  });
  const [saving, setSaving] = useState(false);

  const openAdd = () => {
    setEditing(null);
    setForm({ name: "", start_date: "", end_date: "", is_current: false });
    setOpen(true);
  };
  const openEdit = (y: AcademicYear) => {
    setEditing(y);
    setForm({
      name: y.name,
      start_date: y.start_date,
      end_date: y.end_date,
      is_current: y.is_current,
    });
    setOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (
      !confirm(
        "Delete this academic year? All semesters inside it will also be deleted.",
      )
    )
      return;
    try {
      await deleteAcademicYearApi(id);
      setYears((p: AcademicYear[]) => p.filter((y) => y.id !== id));
      toast.success("Deleted.");
    } catch {
      toast.error("Failed to delete");
    }
  };

  const handleSave = async () => {
    if (!form.name || !form.start_date || !form.end_date) {
      toast.error("All fields required");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const r = await updateAcademicYearApi(editing.id, form);
        setYears((p: AcademicYear[]) =>
          p.map((y) => (y.id === editing.id ? r.data : y)),
        );
        toast.success("Updated!");
      } else {
        const r = await createAcademicYearApi(form);
        setYears((p: AcademicYear[]) => [...p, r.data]);
        toast.success("Created!");
      }
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Card className="shadow-card border-border/50">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div>
            <CardTitle className="font-display text-base">
              Academic Years
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Define the academic years for the institution
            </p>
          </div>
          <Button
            size="sm"
            className="gap-1.5 bg-primary hover:bg-primary/90"
            onClick={openAdd}
          >
            <Plus className="w-4 h-4" /> Add Year
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-y border-border bg-muted/30">
              <tr>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                  Name
                </th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                  Start
                </th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                  End
                </th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                  Semesters
                </th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                  Status
                </th>
                <th className="text-right px-6 py-3 font-medium text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {years.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="text-center py-12 text-muted-foreground"
                  >
                    No academic years yet.
                  </td>
                </tr>
              )}
              {years.map((y) => (
                <tr key={y.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-6 py-4 font-medium">{y.name}</td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {y.start_date}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {y.end_date}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {y.semester_count}
                  </td>
                  <td className="px-6 py-4">
                    {y.is_current && (
                      <span className="flex items-center gap-1 text-xs text-primary font-medium">
                        <CheckCircle className="w-3.5 h-3.5" /> Current
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(y)}
                        className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(y.id)}
                        className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">
              {editing ? "Edit" : "Add"} Academic Year
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <p className={labelCls}>Name *</p>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. 2024/2025"
                className={inputCls}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <p className={labelCls}>Start Date *</p>
                <input
                  type="date"
                  value={form.start_date}
                  onChange={(e) =>
                    setForm({ ...form, start_date: e.target.value })
                  }
                  className={inputCls}
                />
              </div>
              <div className="space-y-1.5">
                <p className={labelCls}>End Date *</p>
                <input
                  type="date"
                  value={form.end_date}
                  onChange={(e) =>
                    setForm({ ...form, end_date: e.target.value })
                  }
                  className={inputCls}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_current}
                onChange={(e) =>
                  setForm({ ...form, is_current: e.target.checked })
                }
                className="w-4 h-4"
              />
              <span className="text-sm">Set as current</span>
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-primary hover:bg-primary/90"
              >
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

// ─── Semesters ────────────────────────────────────────────────────────────────
const SemestersPanel = ({
  semesters,
  setSemesters,
  years,
}: {
  semesters: Semester[];
  setSemesters: any;
  years: AcademicYear[];
}) => {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Semester | null>(null);
  const [form, setForm] = useState({
    academic_year_id: "",
    number: "1",
    start_date: "",
    end_date: "",
    is_current: false,
  });
  const [saving, setSaving] = useState(false);

  const openAdd = () => {
    setEditing(null);
    setForm({
      academic_year_id: "",
      number: "1",
      start_date: "",
      end_date: "",
      is_current: false,
    });
    setOpen(true);
  };
  const openEdit = (s: Semester) => {
    setEditing(s);
    setForm({
      academic_year_id: String(s.academic_year),
      number: String(s.number),
      start_date: s.start_date,
      end_date: s.end_date,
      is_current: s.is_current,
    });
    setOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this semester?")) return;
    try {
      await deleteSemesterApi(id);
      setSemesters((p: Semester[]) => p.filter((s) => s.id !== id));
      toast.success("Deleted.");
    } catch {
      toast.error("Failed");
    }
  };

  const handleSave = async () => {
    if (!form.academic_year_id || !form.start_date || !form.end_date) {
      toast.error("All fields required");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const r = await updateSemesterApi(editing.id, form);
        setSemesters((p: Semester[]) =>
          p.map((s) => (s.id === editing.id ? r.data : s)),
        );
        toast.success("Updated!");
      } else {
        const r = await createSemesterApi({
          ...form,
          academic_year_id: parseInt(form.academic_year_id),
          number: parseInt(form.number),
        });
        setSemesters((p: Semester[]) => [...p, r.data]);
        toast.success("Created!");
      }
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Card className="shadow-card border-border/50">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div>
            <CardTitle className="font-display text-base">Semesters</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Add Semester 1 and 2 for each academic year
            </p>
          </div>
          <Button
            size="sm"
            className="gap-1.5 bg-primary hover:bg-primary/90"
            onClick={openAdd}
          >
            <Plus className="w-4 h-4" /> Add Semester
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-y border-border bg-muted/30">
              <tr>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                  Semester
                </th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                  Academic Year
                </th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                  Start
                </th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                  End
                </th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                  Sections
                </th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                  Status
                </th>
                <th className="text-right px-6 py-3 font-medium text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {semesters.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="text-center py-12 text-muted-foreground"
                  >
                    No semesters yet.
                  </td>
                </tr>
              )}
              {semesters.map((s) => (
                <tr key={s.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-6 py-4 font-medium">Semester {s.number}</td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {s.academic_year_name}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {s.start_date}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {s.end_date}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {s.section_count}
                  </td>
                  <td className="px-6 py-4">
                    {s.is_current && (
                      <span className="flex items-center gap-1 text-xs text-primary font-medium">
                        <CheckCircle className="w-3.5 h-3.5" /> Current
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(s)}
                        className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(s.id)}
                        className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">
              {editing ? "Edit" : "Add"} Semester
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <p className={labelCls}>Academic Year *</p>
              <select
                value={form.academic_year_id}
                onChange={(e) =>
                  setForm({ ...form, academic_year_id: e.target.value })
                }
                className={inputCls}
              >
                <option value="">Select year</option>
                {years.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <p className={labelCls}>Semester Number *</p>
              <select
                value={form.number}
                onChange={(e) => setForm({ ...form, number: e.target.value })}
                className={inputCls}
              >
                <option value="1">Semester 1</option>
                <option value="2">Semester 2</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <p className={labelCls}>Start Date *</p>
                <input
                  type="date"
                  value={form.start_date}
                  onChange={(e) =>
                    setForm({ ...form, start_date: e.target.value })
                  }
                  className={inputCls}
                />
              </div>
              <div className="space-y-1.5">
                <p className={labelCls}>End Date *</p>
                <input
                  type="date"
                  value={form.end_date}
                  onChange={(e) =>
                    setForm({ ...form, end_date: e.target.value })
                  }
                  className={inputCls}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_current}
                onChange={(e) =>
                  setForm({ ...form, is_current: e.target.checked })
                }
                className="w-4 h-4"
              />
              <span className="text-sm">Set as current semester</span>
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-primary hover:bg-primary/90"
              >
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

// ─── Programmes ───────────────────────────────────────────────────────────────
const ProgrammesPanel = ({
  programmes,
  setProgrammes,
}: {
  programmes: Programme[];
  setProgrammes: any;
}) => {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Programme | null>(null);
  const [form, setForm] = useState({ name: "", code: "", duration_years: "4" });
  const [saving, setSaving] = useState(false);

  const openAdd = () => {
    setEditing(null);
    setForm({ name: "", code: "", duration_years: "4" });
    setOpen(true);
  };
  const openEdit = (p: Programme) => {
    setEditing(p);
    setForm({
      name: p.name,
      code: p.code,
      duration_years: String(p.duration_years),
    });
    setOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this programme?")) return;
    try {
      await deleteProgrammeApi(id);
      setProgrammes((p: Programme[]) => p.filter((x) => x.id !== id));
      toast.success("Deleted.");
    } catch {
      toast.error("Failed");
    }
  };

  const handleSave = async () => {
    if (!form.name) {
      toast.error("Name required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        code: form.code,
        duration_years: parseInt(form.duration_years),
      };
      if (editing) {
        const r = await updateProgrammeApi(editing.id, payload);
        setProgrammes((p: Programme[]) =>
          p.map((x) => (x.id === editing.id ? r.data : x)),
        );
        toast.success("Updated!");
      } else {
        const r = await createProgrammeApi(payload);
        setProgrammes((p: Programme[]) => [...p, r.data]);
        toast.success("Added!");
      }
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Card className="shadow-card border-border/50">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div>
            <CardTitle className="font-display text-base">
              Programmes (Schools)
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Each programme = a School/Faculty. e.g. "School of Aircraft
              Maintenance Engineering". Deans are assigned to a programme.
            </p>
          </div>
          <Button
            size="sm"
            className="gap-1.5 bg-primary hover:bg-primary/90"
            onClick={openAdd}
          >
            <Plus className="w-4 h-4" /> Add Programme
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-y border-border bg-muted/30">
              <tr>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                  Name
                </th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                  Code
                </th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                  Duration
                </th>
                <th className="text-right px-6 py-3 font-medium text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {programmes.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="text-center py-12 text-muted-foreground"
                  >
                    No programmes yet.
                  </td>
                </tr>
              )}
              {programmes.map((p) => (
                <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-6 py-4 font-medium">{p.name}</td>
                  <td className="px-6 py-4 text-muted-foreground font-mono text-xs">
                    {p.code || "—"}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {p.duration_years} years
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(p)}
                        className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">
              {editing ? "Edit" : "Add"} Programme
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <p className={labelCls}>Programme Name *</p>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. School of Aircraft Maintenance Engineering"
                className={inputCls}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <p className={labelCls}>Code</p>
                <input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  placeholder="e.g. AME"
                  className={inputCls}
                />
              </div>
              <div className="space-y-1.5">
                <p className={labelCls}>Duration</p>
                <select
                  value={form.duration_years}
                  onChange={(e) =>
                    setForm({ ...form, duration_years: e.target.value })
                  }
                  className={inputCls}
                >
                  {[2, 3, 4, 5].map((y) => (
                    <option key={y} value={y}>
                      {y} years
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-primary hover:bg-primary/90"
              >
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

// ─── Departments ──────────────────────────────────────────────────────────────
const DepartmentsPanel = ({
  departments,
  setDepartments,
  programmes,
}: {
  departments: Department[];
  setDepartments: any;
  programmes: Programme[];
}) => {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [form, setForm] = useState({ name: "", code: "", programme_id: "" });
  const [saving, setSaving] = useState(false);
  const [filterProg, setFilterProg] = useState("");

  const openAdd = () => {
    setEditing(null);
    setForm({ name: "", code: "", programme_id: "" });
    setOpen(true);
  };
  const openEdit = (d: Department) => {
    setEditing(d);
    setForm({ name: d.name, code: d.code, programme_id: String(d.programme) });
    setOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Remove this department?")) return;
    try {
      await deleteDepartmentApi(id);
      setDepartments((p: Department[]) => p.filter((d) => d.id !== id));
      toast.success("Removed.");
    } catch {
      toast.error("Failed");
    }
  };

  const handleSave = async () => {
    if (!form.name || !form.programme_id) {
      toast.error("Name and Programme required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        code: form.code,
        programme_id: parseInt(form.programme_id),
      };
      if (editing) {
        const r = await updateDepartmentApi(editing.id, payload);
        setDepartments((p: Department[]) =>
          p.map((d) => (d.id === editing.id ? r.data : d)),
        );
        toast.success("Updated!");
      } else {
        const r = await createDepartmentApi(payload);
        setDepartments((p: Department[]) => [...p, r.data]);
        toast.success("Department added!");
      }
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Failed");
    } finally {
      setSaving(false);
    }
  };

  const filtered = filterProg
    ? departments.filter((d) => String(d.programme) === filterProg)
    : departments;

  return (
    <>
      <Card className="shadow-card border-border/50">
        <CardHeader className="pb-4">
          <div className="flex flex-row items-start justify-between">
            <div>
              <CardTitle className="font-display text-base">
                Departments
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Each department belongs to a Programme (School). e.g.
                "Engineering Drawing Dept" inside "Aircraft Maintenance
                Engineering". Department Heads are assigned to a department.
                Courses can optionally be linked to a department.
              </p>
            </div>
            <Button
              size="sm"
              className="gap-1.5 bg-primary hover:bg-primary/90"
              onClick={openAdd}
            >
              <Plus className="w-4 h-4" /> Add Department
            </Button>
          </div>
          <div className="mt-3">
            <select
              value={filterProg}
              onChange={(e) => setFilterProg(e.target.value)}
              className="border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">All Programmes</option>
              {programmes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-y border-border bg-muted/30">
              <tr>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                  Department Name
                </th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                  Code
                </th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                  Programme (School)
                </th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                  Courses
                </th>
                <th className="text-right px-6 py-3 font-medium text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="text-center py-12 text-muted-foreground"
                  >
                    {departments.length === 0
                      ? "No departments yet. Create programmes first, then add departments."
                      : "No departments for the selected programme."}
                  </td>
                </tr>
              )}
              {filtered.map((d) => (
                <tr key={d.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-6 py-4 font-medium">{d.name}</td>
                  <td className="px-6 py-4 text-muted-foreground font-mono text-xs">
                    {d.code || "—"}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {d.programme_name}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {d.course_count}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(d)}
                        className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(d.id)}
                        className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">
              {editing ? "Edit" : "Add"} Department
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <p className={labelCls}>Programme (School) *</p>
              <select
                value={form.programme_id}
                onChange={(e) =>
                  setForm({ ...form, programme_id: e.target.value })
                }
                className={inputCls}
              >
                <option value="">Select programme</option>
                {programmes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <p className={labelCls}>Department Name *</p>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Engineering Drawing Department"
                className={inputCls}
              />
            </div>
            <div className="space-y-1.5">
              <p className={labelCls}>Code</p>
              <input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="e.g. ENG-DRAW"
                className={inputCls}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-primary hover:bg-primary/90"
              >
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

// ─── Sections ─────────────────────────────────────────────────────────────────
const SectionsPanel = ({
  sections,
  setSections,
  semesters,
  programmes,
  filterSemester,
  setFilterSemester,
  filterProgramme,
  setFilterProgramme,
}: any) => {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    programme_id: "",
    year: "1",
    semester_id: "",
  });
  const [saving, setSaving] = useState(false);
  const selectedProg = programmes.find(
    (p: Programme) => p.id === parseInt(form.programme_id),
  );
  const years = selectedProg
    ? Array.from(
        { length: selectedProg.duration_years },
        (_: any, i: number) => i + 1,
      )
    : [1, 2, 3, 4];

  const handleSave = async () => {
    if (!form.name || !form.programme_id || !form.semester_id) {
      toast.error("All fields required");
      return;
    }
    setSaving(true);
    try {
      const r = await createSectionApi({
        name: form.name,
        programme_id: parseInt(form.programme_id),
        year: parseInt(form.year),
        semester_id: parseInt(form.semester_id),
      });
      setSections((p: Section[]) => [...p, r.data]);
      toast.success("Section created!");
      setOpen(false);
      setForm({ name: "", programme_id: "", year: "1", semester_id: "" });
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this section?")) return;
    try {
      await deleteSectionApi(id);
      setSections((p: Section[]) => p.filter((s: Section) => s.id !== id));
      toast.success("Deleted.");
    } catch {
      toast.error("Failed");
    }
  };

  const [manageOpen, setManageOpen] = useState(false);
  const [managingSection, setManagingSection] = useState<Section | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [enrollLoading, setEnrollLoading] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");
  const [manageTab, setManageTab] = useState<"search" | "csv">("search");
  const [csvText, setCsvText] = useState("");
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvPreview, setCsvPreview] = useState<
    { id: string; found?: number; name?: string; error?: string }[]
  >([]);
  const [csvParsed, setCsvParsed] = useState(false);

  const openManage = async (s: Section) => {
    setManagingSection(s);
    setManageOpen(true);
    setManageTab("search");
    setCsvText("");
    setCsvPreview([]);
    setCsvParsed(false);
    setStudentSearch("");
    setEnrollLoading(true);
    try {
      const [er, sr] = await Promise.all([
        getEnrollmentsApi({ section: s.id }),
        getStudentsApi({ active_only: true }),
      ]);
      setEnrollments(er.data);
      setAllStudents(sr.data);
    } catch {
      toast.error("Failed to load");
    } finally {
      setEnrollLoading(false);
    }
  };

  const enrolledIds = new Set(enrollments.map((e: Enrollment) => e.student));

  const handleEnroll = async (studentId: number) => {
    if (!managingSection) return;
    try {
      const r = await createEnrollmentApi({
        student_id: studentId,
        section_id: managingSection.id,
      });
      setEnrollments((p) => [...p, r.data]);
      setSections((p: Section[]) =>
        p.map((s: Section) =>
          s.id === managingSection.id
            ? { ...s, student_count: s.student_count + 1 }
            : s,
        ),
      );
      toast.success("Enrolled!");
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Failed");
    }
  };

  const handleUnenroll = async (enrollmentId: number) => {
    if (!confirm("Remove student?")) return;
    try {
      await deleteEnrollmentApi(enrollmentId);
      setEnrollments((p) => p.filter((e: Enrollment) => e.id !== enrollmentId));
      setSections((p: Section[]) =>
        p.map((s: Section) =>
          s.id === managingSection?.id
            ? { ...s, student_count: Math.max(0, s.student_count - 1) }
            : s,
        ),
      );
      toast.success("Removed.");
    } catch {
      toast.error("Failed");
    }
  };

  const filteredAvailable = allStudents.filter(
    (s: Student) =>
      !enrolledIds.has(s.id) &&
      (studentSearch === "" ||
        s.full_name.toLowerCase().includes(studentSearch.toLowerCase()) ||
        s.student_id.toLowerCase().includes(studentSearch.toLowerCase())),
  );

  const handleCsvPreview = () => {
    const ids = csvText
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!ids.length) {
      toast.error("Paste at least one ID");
      return;
    }
    setCsvPreview(
      ids.map((id) => {
        const s = allStudents.find((x: Student) => x.student_id === id);
        if (!s) return { id, error: "Not found" };
        if (enrolledIds.has(s.id))
          return {
            id,
            found: s.id,
            name: s.full_name,
            error: "Already enrolled",
          };
        return { id, found: s.id, name: s.full_name };
      }),
    );
    setCsvParsed(true);
  };

  const handleCsvImport = async () => {
    if (!managingSection) return;
    const toEnroll = csvPreview
      .filter((r) => r.found && !r.error)
      .map((r) => r.found as number);
    if (!toEnroll.length) {
      toast.error("No valid students");
      return;
    }
    setCsvImporting(true);
    try {
      const r = await bulkEnrollApi({
        section_id: managingSection.id,
        student_ids: toEnroll,
      });
      const er = await getEnrollmentsApi({ section: managingSection.id });
      setEnrollments(er.data);
      setSections((p: Section[]) =>
        p.map((s: Section) =>
          s.id === managingSection.id
            ? { ...s, student_count: s.student_count + r.data.enrolled }
            : s,
        ),
      );
      toast.success(`Imported ${r.data.enrolled} students!`);
      setCsvText("");
      setCsvPreview([]);
      setCsvParsed(false);
      setManageTab("search");
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Failed");
    } finally {
      setCsvImporting(false);
    }
  };

  return (
    <>
      <Card className="shadow-card border-border/50">
        <CardHeader className="pb-4">
          <div className="flex flex-row items-start justify-between">
            <div>
              <CardTitle className="font-display text-base">Sections</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Create student groups per programme, year, and semester
              </p>
            </div>
            <Button
              size="sm"
              className="gap-1.5 bg-primary hover:bg-primary/90"
              onClick={() => setOpen(true)}
            >
              <Plus className="w-4 h-4" /> Add Section
            </Button>
          </div>
          <div className="flex gap-3 mt-3 flex-wrap">
            <select
              value={filterSemester}
              onChange={(e) => setFilterSemester(e.target.value)}
              className="border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">All Semesters</option>
              {semesters.map((s: Semester) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                  {s.is_current ? " (Current)" : ""}
                </option>
              ))}
            </select>
            <select
              value={filterProgramme}
              onChange={(e) => setFilterProgramme(e.target.value)}
              className="border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">All Programmes</option>
              {programmes.map((p: Programme) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-y border-border bg-muted/30">
              <tr>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                  Section
                </th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                  Programme
                </th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                  Year
                </th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                  Semester
                </th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                  Students
                </th>
                <th className="text-right px-6 py-3 font-medium text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sections.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="text-center py-12 text-muted-foreground"
                  >
                    No sections found.
                  </td>
                </tr>
              )}
              {sections.map((s: Section) => (
                <tr key={s.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-6 py-4 font-medium">Section {s.name}</td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {s.programme_name}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    Year {s.year}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {s.semester_label}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {s.student_count}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openManage(s)}
                        className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                      >
                        <Users className="w-3 h-3" /> Manage Students
                      </button>
                      <button
                        onClick={() => handleDelete(s.id)}
                        className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Add Section</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <p className={labelCls}>Section Name *</p>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. A, B"
                  className={inputCls}
                />
              </div>
              <div className="space-y-1.5">
                <p className={labelCls}>Year *</p>
                <select
                  value={form.year}
                  onChange={(e) => setForm({ ...form, year: e.target.value })}
                  className={inputCls}
                >
                  {years.map((y: number) => (
                    <option key={y} value={y}>
                      Year {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <p className={labelCls}>Programme *</p>
              <select
                value={form.programme_id}
                onChange={(e) =>
                  setForm({ ...form, programme_id: e.target.value })
                }
                className={inputCls}
              >
                <option value="">Select programme</option>
                {programmes.map((p: Programme) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <p className={labelCls}>Semester *</p>
              <select
                value={form.semester_id}
                onChange={(e) =>
                  setForm({ ...form, semester_id: e.target.value })
                }
                className={inputCls}
              >
                <option value="">Select semester</option>
                {semesters.map((s: Semester) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                    {s.is_current ? " (Current)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-primary hover:bg-primary/90"
              >
                {saving ? "Saving..." : "Add Section"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">
              Manage Students — Section {managingSection?.name} (
              {managingSection?.semester_label})
            </DialogTitle>
          </DialogHeader>
          {enrollLoading ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              Loading...
            </div>
          ) : (
            <div className="space-y-5 pt-2">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Enrolled ({enrollments.length})
                </p>
                {enrollments.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">
                    No students enrolled yet.
                  </p>
                ) : (
                  <div className="border border-border rounded-lg divide-y divide-border max-h-44 overflow-y-auto">
                    {enrollments.map((e: Enrollment) => (
                      <div
                        key={e.id}
                        className="flex items-center justify-between px-4 py-2.5"
                      >
                        <div>
                          <p className="text-sm font-medium">
                            {e.student_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {e.student_id_number}
                          </p>
                        </div>
                        <button
                          onClick={() => handleUnenroll(e.id)}
                          className="text-xs text-destructive hover:underline px-2 py-1"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-1 border-b border-border">
                {(["search", "csv"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setManageTab(tab)}
                    className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${manageTab === tab ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
                  >
                    {tab === "search" ? "Search & Add" : "Import by Student ID"}
                  </button>
                ))}
              </div>
              {manageTab === "search" && (
                <div>
                  <input
                    placeholder="Search by name or ID..."
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    className={`${inputCls} mb-2`}
                  />
                  <div className="border border-border rounded-lg divide-y divide-border max-h-56 overflow-y-auto">
                    {filteredAvailable.length === 0 && (
                      <p className="text-sm text-muted-foreground italic px-4 py-3">
                        {studentSearch
                          ? "No match."
                          : "All enrolled or no students."}
                      </p>
                    )}
                    {filteredAvailable.map((s: Student) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between px-4 py-2.5"
                      >
                        <div>
                          <p className="text-sm font-medium">{s.full_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {s.student_id} · {s.programme_name}
                          </p>
                        </div>
                        <button
                          onClick={() => handleEnroll(s.id)}
                          className="text-xs font-medium text-primary hover:underline px-2 py-1 bg-primary/10 rounded"
                        >
                          + Enroll
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {manageTab === "csv" && (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Paste student IDs separated by commas or new lines. Students
                    must already exist in the system.
                  </p>
                  <textarea
                    rows={5}
                    value={csvText}
                    onChange={(e) => {
                      setCsvText(e.target.value);
                      setCsvParsed(false);
                      setCsvPreview([]);
                    }}
                    placeholder={"STU001\nSTU002"}
                    className={`${inputCls} font-mono resize-none`}
                  />
                  {!csvParsed ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCsvPreview}
                      disabled={!csvText.trim()}
                    >
                      Preview
                    </Button>
                  ) : (
                    <>
                      <div className="border border-border rounded-lg divide-y divide-border max-h-52 overflow-y-auto text-sm">
                        {csvPreview.map((row, i) => (
                          <div
                            key={i}
                            className={`flex items-center justify-between px-4 py-2 ${row.error ? "bg-destructive/5" : "bg-green-500/5"}`}
                          >
                            <div>
                              <span className="font-mono font-medium">
                                {row.id}
                              </span>
                              {row.name && (
                                <span className="ml-2 text-muted-foreground">
                                  {row.name}
                                </span>
                              )}
                            </div>
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full ${row.error ? "bg-destructive/10 text-destructive" : "bg-green-500/10 text-green-700"}`}
                            >
                              {row.error ?? "Ready"}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="text-xs text-muted-foreground flex-1">
                          {csvPreview.filter((r) => !r.error).length} will
                          enroll, {csvPreview.filter((r) => !!r.error).length}{" "}
                          skipped
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setCsvParsed(false);
                            setCsvPreview([]);
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          className="bg-primary hover:bg-primary/90"
                          onClick={handleCsvImport}
                          disabled={
                            csvImporting ||
                            !csvPreview.filter((r) => !r.error).length
                          }
                        >
                          {csvImporting ? "Importing..." : "Import"}
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

// ─── Course Offerings ─────────────────────────────────────────────────────────
const OfferingsPanel = ({
  offerings,
  setOfferings,
  sections,
  courses,
  teachers,
  semesters,
  programmes,
  filterSemester,
  setFilterSemester,
  filterProgramme,
  setFilterProgramme,
}: any) => {
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Offering | null>(null);
  const [form, setForm] = useState({
    course_id: "",
    section_id: "",
    teacher_id: "",
  });
  const [editTeacher, setEditTeacher] = useState("");
  const [saving, setSaving] = useState(false);

  const filteredSections = sections.filter(
    (s: Section) => !filterSemester || String(s.semester) === filterSemester,
  );

  const handleAdd = async () => {
    if (!form.course_id || !form.section_id) {
      toast.error("Course and section required");
      return;
    }
    setSaving(true);
    try {
      const r = await createOfferingApi({
        course_id: parseInt(form.course_id),
        section_id: parseInt(form.section_id),
        teacher_id: form.teacher_id ? parseInt(form.teacher_id) : undefined,
      });
      setOfferings((p: Offering[]) => [...p, r.data]);
      toast.success("Offering created!");
      setOpen(false);
      setForm({ course_id: "", section_id: "", teacher_id: "" });
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Failed");
    } finally {
      setSaving(false);
    }
  };

  const handleEditTeacher = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const r = await updateOfferingApi(editing.id, {
        teacher_id: editTeacher ? parseInt(editTeacher) : undefined,
      });
      setOfferings((p: Offering[]) =>
        p.map((o: Offering) => (o.id === editing.id ? r.data : o)),
      );
      toast.success("Teacher updated!");
      setEditOpen(false);
    } catch {
      toast.error("Failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Remove this offering?")) return;
    try {
      await deleteOfferingApi(id);
      setOfferings((p: Offering[]) => p.filter((o: Offering) => o.id !== id));
      toast.success("Removed.");
    } catch {
      toast.error("Failed");
    }
  };

  return (
    <>
      <Card className="shadow-card border-border/50">
        <CardHeader className="pb-4">
          <div className="flex flex-row items-start justify-between">
            <div>
              <CardTitle className="font-display text-base">
                Course Offerings
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Assign courses to sections and teachers for each semester
              </p>
            </div>
            <Button
              size="sm"
              className="gap-1.5 bg-primary hover:bg-primary/90"
              onClick={() => setOpen(true)}
            >
              <Plus className="w-4 h-4" /> Add Offering
            </Button>
          </div>
          <div className="flex gap-3 mt-3 flex-wrap">
            <select
              value={filterSemester}
              onChange={(e) => setFilterSemester(e.target.value)}
              className="border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">All Semesters</option>
              {semesters.map((s: Semester) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                  {s.is_current ? " (Current)" : ""}
                </option>
              ))}
            </select>
            <select
              value={filterProgramme}
              onChange={(e) => setFilterProgramme(e.target.value)}
              className="border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">All Programmes</option>
              {programmes.map((p: Programme) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-y border-border bg-muted/30">
              <tr>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                  Course
                </th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                  Section
                </th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                  Programme
                </th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                  Semester
                </th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                  Teacher
                </th>
                <th className="text-right px-6 py-3 font-medium text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {offerings.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="text-center py-12 text-muted-foreground"
                  >
                    No course offerings found.
                  </td>
                </tr>
              )}
              {offerings.map((o: Offering) => (
                <tr key={o.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-6 py-4 font-medium text-primary">
                    {o.course_name}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    Sec {o.section_name} Y{o.section_year}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {o.programme_name}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {o.semester_label}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {o.teacher_name || (
                      <span className="text-destructive/70 text-xs">
                        Unassigned
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => {
                          setEditing(o);
                          setEditTeacher(o.teacher ? String(o.teacher) : "");
                          setEditOpen(true);
                        }}
                        className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(o.id)}
                        className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">
              Add Course Offering
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <p className={labelCls}>Course *</p>
              <select
                value={form.course_id}
                onChange={(e) =>
                  setForm({ ...form, course_id: e.target.value })
                }
                className={inputCls}
              >
                <option value="">Select course</option>
                {courses.map((c: Course) => (
                  <option key={c.id} value={c.id}>
                    {c.name} (Y{c.year})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <p className={labelCls}>Section *</p>
              <select
                value={form.section_id}
                onChange={(e) =>
                  setForm({ ...form, section_id: e.target.value })
                }
                className={inputCls}
              >
                <option value="">Select section</option>
                {filteredSections.map((s: Section) => (
                  <option key={s.id} value={s.id}>
                    Sec {s.name} · Y{s.year} · {s.programme_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <p className={labelCls}>Teacher</p>
              <select
                value={form.teacher_id}
                onChange={(e) =>
                  setForm({ ...form, teacher_id: e.target.value })
                }
                className={inputCls}
              >
                <option value="">Assign later</option>
                {teachers.map((t: User) => (
                  <option key={t.id} value={t.id}>
                    {t.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleAdd}
                disabled={saving}
                className="bg-primary hover:bg-primary/90"
              >
                {saving ? "Saving..." : "Add Offering"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Assign Teacher</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              {editing?.course_name} — Sec {editing?.section_name}
            </p>
            <div className="space-y-1.5">
              <p className={labelCls}>Teacher</p>
              <select
                value={editTeacher}
                onChange={(e) => setEditTeacher(e.target.value)}
                className={inputCls}
              >
                <option value="">Unassigned</option>
                {teachers.map((t: User) => (
                  <option key={t.id} value={t.id}>
                    {t.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleEditTeacher}
                disabled={saving}
                className="bg-primary hover:bg-primary/90"
              >
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SetupTab;
