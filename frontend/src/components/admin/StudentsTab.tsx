import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Pencil, Trash2, Plus, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  getStudentsApi,
  createStudentApi,
  updateStudentApi,
  deleteStudentApi,
  getSectionsApi,
  getSemestersApi,
  bulkImportStudentsApi,
  createUserApi,
} from "@/api/axios";

interface Programme {
  id: number;
  name: string;
  duration_years: number;
}
interface Semester {
  id: number;
  label: string;
  number: number;
  is_current: boolean;
}
interface Section {
  id: number;
  name: string;
  year: number;
  semester_label: string;
}
interface Student {
  id: number;
  first_name: string;
  last_name: string;
  student_id: string;
  email: string;
  parent_email: string;
  parent_telegram: string;
  programme_name: string;
  is_active: boolean;
  current_section: {
    section_id: number;
    section_name: string;
    year: number;
    programme: string;
    semester: string;
  } | null;
}

interface StudentsTabProps {
  programmes: Programme[];
  scopeParams?: Record<string, any>;
}

// Auto-generate a default password (student ID + "@EAU")
const makePassword = (studentId: string) => `${studentId}@EAU`;

// Download a single student's credentials as a CSV
const downloadCredentialsCsv = (
  firstName: string,
  lastName: string,
  email: string,
  studentId: string,
) => {
  const csv = [
    "name,email,student_id,password",
    `${firstName} ${lastName},${email},${studentId},${makePassword(studentId)}`,
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `credentials_${studentId.replace(/[^a-zA-Z0-9]/g, "_")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

const StudentsTab = ({ programmes, scopeParams = {} }: StudentsTabProps) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [semesters, setSemesters] = useState<Semester[]>([]);

  // Filters
  const [filterProgramme, setFilterProgramme] = useState("");
  const [filterSemester, setFilterSemester] = useState("");
  const [filterSection, setFilterSection] = useState("");
  const [sections, setSections] = useState<Section[]>([]);

  // Edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editStudent, setEditStudent] = useState<Student | null>(null);
  const [editForm, setEditForm] = useState({
    first_name: "",
    last_name: "",
    student_id: "",
    email: "",
    parent_email: "",
    parent_telegram: "",
    programme_id: "",
  });
  const [saving, setSaving] = useState(false);

  // Add modal
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    first_name: "",
    last_name: "",
    student_id: "",
    email: "",
    parent_email: "",
    parent_telegram: "",
    programme_id: scopeParams.programme ? String(scopeParams.programme) : "",
    section_id: "",
  });
  const [addSemester, setAddSemester] = useState("");
  const [addSections, setAddSections] = useState<Section[]>([]);
  const [addYear, setAddYear] = useState("");
  const [adding, setAdding] = useState(false);
  // FIX 3: toggle to also create a login account
  const [createLoginAccount, setCreateLoginAccount] = useState(true);

  // Bulk import
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);

  // Load semesters on mount
  useEffect(() => {
    getSemestersApi().then((res) => setSemesters(res.data || []));
    fetchStudents();
  }, []);

  // FIX 1: don't pass active_only by default — caused the empty list bug
  const fetchStudents = async () => {
    try {
      setLoading(true);
      const params: Record<string, any> = {};
      // Apply scope restriction for dean/dept_head
      if (scopeParams.programme) params.programme = scopeParams.programme;
      // Allow local filter to override/narrow scope
      if (filterProgramme) params.programme = filterProgramme;
      if (filterSemester) params.semester = filterSemester;
      if (filterSection) params.section = filterSection;
      if (search) params.search = search;
      const res = await getStudentsApi(params);
      setStudents(res.data || []);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load students");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [filterProgramme, filterSemester, filterSection]);

  // When semester + programme changes, load sections
  useEffect(() => {
    if (!filterSemester) {
      setSections([]);
      setFilterSection("");
      return;
    }
    const params: Record<string, string> = { semester: filterSemester };
    if (filterProgramme) params.programme = filterProgramme;
    getSectionsApi(params).then((res) => setSections(res.data || []));
    setFilterSection("");
  }, [filterSemester, filterProgramme]);

  // Add modal — load sections when semester + year selected
  useEffect(() => {
    if (!addSemester || !addYear || !addForm.programme_id) {
      setAddSections([]);
      return;
    }
    getSectionsApi({
      semester: parseInt(addSemester),
      programme: parseInt(addForm.programme_id),
      year: parseInt(addYear),
    }).then((res) => setAddSections(res.data || []));
  }, [addSemester, addYear, addForm.programme_id]);

  const openEdit = (student: Student) => {
    setEditStudent(student);
    // Find programme id from programmes list by matching name
    const prog = programmes.find((p) => p.name === student.programme_name);
    setEditForm({
      first_name: student.first_name,
      last_name: student.last_name,
      student_id: student.student_id,
      email: student.email,
      parent_email: student.parent_email || "",
      parent_telegram: student.parent_telegram || "",
      programme_id: prog ? String(prog.id) : "",
    });
    setEditOpen(true);
  };

  const handleSave = async () => {
    if (!editStudent) return;
    setSaving(true);
    try {
      const payload: any = {
        first_name: editForm.first_name,
        last_name: editForm.last_name,
        student_id: editForm.student_id,
        email: editForm.email,
        parent_email: editForm.parent_email,
        parent_telegram: editForm.parent_telegram,
      };
      if (editForm.programme_id) payload.programme_id = parseInt(editForm.programme_id);
      await updateStudentApi(editStudent.id, payload);
      setStudents((prev) =>
        prev.map((s) => (s.id === editStudent.id ? { ...s, ...editForm,
          student_id: editForm.student_id,
          programme_name: programmes.find((p) => String(p.id) === editForm.programme_id)?.name || s.programme_name,
        } : s)),
      );
      toast.success("Student updated!");
      setEditOpen(false);
    } catch {
      toast.error("Failed to update student");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Deactivate this student? Their records will be kept."))
      return;
    try {
      await deleteStudentApi(id);
      setStudents((prev) => prev.filter((s) => s.id !== id));
      toast.success("Student deactivated.");
    } catch {
      toast.error("Failed to deactivate student");
    }
  };

  const handleAdd = async () => {
    if (
      !addForm.first_name ||
      !addForm.last_name ||
      !addForm.student_id ||
      !addForm.email
    ) {
      toast.error("Please fill all required fields");
      return;
    }
    setAdding(true);
    try {
      // FIX 2: pass args inline — no intermediate payload variable
      const res = await createStudentApi({
        first_name: addForm.first_name,
        last_name: addForm.last_name,
        student_id: addForm.student_id,
        email: addForm.email,
        parent_email: addForm.parent_email || undefined,
        parent_telegram: addForm.parent_telegram || undefined,
        programme_id: addForm.programme_id
          ? parseInt(addForm.programme_id)
          : undefined,
        section_id: addForm.section_id
          ? parseInt(addForm.section_id)
          : undefined,
      });
      setStudents((prev) => [...prev, res.data]);

      // FIX 3: optionally create a login account so student appears in UserRoles
      if (createLoginAccount) {
        try {
          await createUserApi({
            username: addForm.email,
            first_name: addForm.first_name,
            last_name: addForm.last_name,
            email: addForm.email,
            staff_id: addForm.student_id,
            role: "student",
            password: makePassword(addForm.student_id),
          });
          // Auto-download credentials CSV
          downloadCredentialsCsv(
            addForm.first_name,
            addForm.last_name,
            addForm.email,
            addForm.student_id,
          );
          toast.success(
            `Student added! Credentials CSV downloaded. Password: ${makePassword(addForm.student_id)}`,
            { duration: 8000 },
          );
        } catch {
          toast.success("Student added!");
          toast.warning(
            "Could not create login account — an account with this email may already exist.",
          );
        }
      } else {
        toast.success("Student added!");
      }

      setAddOpen(false);
      setAddForm({
        first_name: "",
        last_name: "",
        student_id: "",
        email: "",
        parent_email: "",
        parent_telegram: "",
        programme_id: scopeParams.programme ? String(scopeParams.programme) : "",
        section_id: "",
      });
      setAddSemester("");
      setAddYear("");
      setCreateLoginAccount(true);
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Failed to add student");
    } finally {
      setAdding(false);
    }
  };

  const handleBulkImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const res = await bulkImportStudentsApi(file);
      toast.success(res.data.message);
      fetchStudents();
      setImportOpen(false);
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const filtered = students.filter((s) => {
    if (!search) return true;
    const name = `${s.first_name} ${s.last_name}`.toLowerCase();
    return (
      name.includes(search.toLowerCase()) ||
      s.student_id.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase())
    );
  });

  const addYears = addForm.programme_id
    ? Array.from(
        {
          length:
            programmes.find((p) => p.id === parseInt(addForm.programme_id))
              ?.duration_years || 4,
        },
        (_, i) => i + 1,
      )
    : [];

  return (
    <>
      <Card className="shadow-card border-border/50">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <CardTitle className="font-display text-base">
                Student Management
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => setImportOpen(true)}
                >
                  <Upload className="w-4 h-4" /> Import CSV
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5 bg-primary hover:bg-primary/90"
                  onClick={() => setAddOpen(true)}
                >
                  <Plus className="w-4 h-4" /> Add Student
                </Button>
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-end">
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

              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search students..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && fetchStudents()}
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
                  Name
                </th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                  University ID
                </th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                  Programme / Section
                </th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                  Email
                </th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                  Parent Telegram
                </th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                  Parent Email
                </th>
                <th className="text-right px-6 py-3 font-medium text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && (
                <tr>
                  <td
                    colSpan={7}
                    className="text-center py-12 text-muted-foreground"
                  >
                    Loading students...
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="text-center py-12 text-muted-foreground"
                  >
                    No students found
                  </td>
                </tr>
              )}
              {filtered.map((s) => (
                <tr key={s.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-6 py-4 font-medium">
                    {s.first_name} {s.last_name}
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-primary">
                    {s.student_id}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground text-xs">
                    <p>
                      {s.current_section?.programme || s.programme_name || "—"}
                    </p>
                    {s.current_section && (
                      <p className="text-muted-foreground/60">
                        Y{s.current_section.year} · Sec{" "}
                        {s.current_section.section_name}
                      </p>
                    )}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">{s.email}</td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {s.parent_telegram ? (
                      <span className="text-blue-500">
                        @{s.parent_telegram.replace("@", "")}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {s.parent_email || "—"}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
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

      {/* Edit Modal */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Edit Student</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  First Name
                </p>
                <input
                  value={editForm.first_name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, first_name: e.target.value })
                  }
                  className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Last Name
                </p>
                <input
                  value={editForm.last_name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, last_name: e.target.value })
                  }
                  className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                University ID
              </p>
              <input
                value={editForm.student_id}
                onChange={(e) =>
                  setEditForm({ ...editForm, student_id: e.target.value })
                }
                className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Programme
              </p>
              <select
                value={editForm.programme_id}
                onChange={(e) =>
                  setEditForm({ ...editForm, programme_id: e.target.value })
                }
                className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">— Select programme —</option>
                {programmes.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Email
              </p>
              <input
                value={editForm.email}
                onChange={(e) =>
                  setEditForm({ ...editForm, email: e.target.value })
                }
                className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Parent Telegram
              </p>
              <input
                value={editForm.parent_telegram}
                onChange={(e) =>
                  setEditForm({ ...editForm, parent_telegram: e.target.value })
                }
                placeholder="@username"
                className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Parent Email
              </p>
              <input
                value={editForm.parent_email}
                onChange={(e) =>
                  setEditForm({ ...editForm, parent_email: e.target.value })
                }
                className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-primary hover:bg-primary/90"
              >
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Student Modal */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">Add New Student</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  First Name *
                </p>
                <input
                  value={addForm.first_name}
                  onChange={(e) =>
                    setAddForm({ ...addForm, first_name: e.target.value })
                  }
                  className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Last Name *
                </p>
                <input
                  value={addForm.last_name}
                  onChange={(e) =>
                    setAddForm({ ...addForm, last_name: e.target.value })
                  }
                  className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Registration No *
                </p>
                <input
                  value={addForm.student_id}
                  onChange={(e) =>
                    setAddForm({ ...addForm, student_id: e.target.value })
                  }
                  placeholder="UGR/10001/24"
                  className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Email *
                </p>
                <input
                  value={addForm.email}
                  onChange={(e) =>
                    setAddForm({ ...addForm, email: e.target.value })
                  }
                  className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            {/* Programme → Semester → Year → Section */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Programme
                </p>
                <select
                  value={addForm.programme_id}
                  onChange={(e) =>
                    setAddForm({
                      ...addForm,
                      programme_id: e.target.value,
                      section_id: "",
                    })
                  }
                  className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Select</option>
                  {programmes.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Semester
                </p>
                <select
                  value={addSemester}
                  onChange={(e) => setAddSemester(e.target.value)}
                  className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Select</option>
                  {semesters.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                      {s.is_current ? " (Current)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Year
                </p>
                <select
                  value={addYear}
                  onChange={(e) => setAddYear(e.target.value)}
                  disabled={!addForm.programme_id}
                  className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                >
                  <option value="">Select</option>
                  {addYears.map((y) => (
                    <option key={y} value={y}>
                      Year {y}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Section
                </p>
                <select
                  value={addForm.section_id}
                  onChange={(e) =>
                    setAddForm({ ...addForm, section_id: e.target.value })
                  }
                  disabled={!addSections.length}
                  className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                >
                  <option value="">Select</option>
                  {addSections.map((s) => (
                    <option key={s.id} value={s.id}>
                      Section {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Parent Email
                </p>
                <input
                  value={addForm.parent_email}
                  onChange={(e) =>
                    setAddForm({ ...addForm, parent_email: e.target.value })
                  }
                  className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Parent Telegram
                </p>
                <input
                  value={addForm.parent_telegram}
                  onChange={(e) =>
                    setAddForm({ ...addForm, parent_telegram: e.target.value })
                  }
                  placeholder="@username"
                  className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            {/* FIX 3: Login account toggle */}
            <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-1">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={createLoginAccount}
                  onChange={(e) => setCreateLoginAccount(e.target.checked)}
                  className="w-4 h-4 accent-primary"
                />
                <div>
                  <p className="text-sm font-medium">Create login account</p>
                  <p className="text-xs text-muted-foreground">
                    Adds this student to User Roles with role{" "}
                    <strong>student</strong>
                  </p>
                </div>
              </label>
              {createLoginAccount && addForm.student_id && addForm.email && (
                <div className="mt-2 ml-7 text-xs text-muted-foreground bg-muted rounded px-2 py-1.5 space-y-0.5">
                  <p>
                    Login with:{" "}
                    <span className="font-mono font-medium">
                      {addForm.student_id}
                    </span>{" "}
                    or{" "}
                    <span className="font-mono font-medium">
                      {addForm.email}
                    </span>
                  </p>
                  <p>
                    Password:{" "}
                    <span className="font-mono font-medium">
                      {makePassword(addForm.student_id)}
                    </span>
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleAdd}
                disabled={adding}
                className="bg-primary hover:bg-primary/90"
              >
                {adding ? "Adding..." : "Add Student"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Import Modal */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">
              Bulk Import Students
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="p-4 bg-muted/30 rounded-lg text-sm text-muted-foreground space-y-2">
              <p className="font-medium text-foreground">
                CSV Format Required:
              </p>
              <p className="font-mono text-xs">
                first_name, last_name, student_id, email, programme_code,
                section_id, parent_email, parent_telegram
              </p>
              <p>
                The <span className="font-medium">programme_code</span> must
                match the programme code in the system. The{" "}
                <span className="font-medium">section_id</span> is optional —
                students can be enrolled later.
              </p>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Upload CSV File
              </p>
              <input
                type="file"
                accept=".csv"
                onChange={handleBulkImport}
                disabled={importing}
                className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none"
              />
              {importing && (
                <p className="text-xs text-muted-foreground">Importing...</p>
              )}
            </div>
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setImportOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default StudentsTab;