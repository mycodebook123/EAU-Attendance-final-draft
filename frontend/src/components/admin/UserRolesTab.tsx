import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Shield,
  Pencil,
  Trash2,
  Plus,
  Upload,
  Eye,
  EyeOff,
  RefreshCw,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import {
  getUsersApi,
  createUserApi,
  updateUserApi,
  deleteUserApi,
  getProgrammesApi,
  getDepartmentsApi,
  getOfferingsApi,
} from "@/api/axios";
import * as XLSX from "xlsx";

interface User {
  id: number;
  username: string;
  staff_id?: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  managed_programme?: number | null;
  managed_programme_name?: string;
  managed_department?: number | null;
  managed_department_name?: string;
  teaching_courses?: string[];
}

interface Programme {
  id: number;
  name: string;
}
interface Department {
  id: number;
  name: string;
  programme_name?: string;
}

const roleStyles: Record<string, string> = {
  admin: "bg-destructive/10 text-destructive border-destructive/30",
  dean: "bg-purple-100 text-purple-700 border-purple-300",
  dept_head: "bg-orange-100 text-orange-700 border-orange-300",
  teacher: "bg-primary/10 text-primary border-primary/30",
  student: "bg-blue-100 text-blue-700 border-blue-300",
};

const roleLabels: Record<string, string> = {
  admin: "Admin",
  dean: "Dean",
  dept_head: "Dept Head",
  teacher: "Teacher",
  student: "Student",
};

const generatePassword = () => {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#!";
  return Array.from(
    { length: 10 },
    () => chars[Math.floor(Math.random() * chars.length)],
  ).join("");
};

type ImportType = "teachers" | "admins" | "students" | "parents";
interface ImportResult {
  created: number;
  errors: { row: number; error: string }[];
  credentials: {
    name: string;
    email: string;
    username: string;
    password: string;
  }[];
}

const parseFileToRows = async (
  file: File,
): Promise<Record<string, string>[]> => {
  const isExcel = file.name.endsWith(".xlsx") || file.name.endsWith(".xls");
  if (isExcel) {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw: any[][] = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      defval: "",
    });
    const headers = (raw[0] as string[]).map((h) =>
      String(h).trim().toLowerCase().replace("(optional)", ""),
    );
    return raw
      .slice(1)
      .filter((r) => r.some((v: any) => String(v).trim() !== ""))
      .map((r) => {
        const obj: Record<string, string> = {};
        headers.forEach((h, i) => {
          obj[h] = String(r[i] ?? "").trim();
        });
        return obj;
      });
  } else {
    const text = await file.text();
    const lines = text.split("\n").filter(Boolean);
    const headers = lines[0]
      .split(",")
      .map((h) => h.trim().toLowerCase().replace("(optional)", ""));
    return lines.slice(1).map((line) => {
      const values = line.split(",").map((v) => v.trim());
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => {
        obj[h] = values[i] || "";
      });
      return obj;
    });
  }
};

const ScopeField = ({
  role,
  value,
  onChange,
  programmes,
  departments,
}: {
  role: string;
  value: {
    managed_programme?: number | null;
    managed_department?: number | null;
  };
  onChange: (v: any) => void;
  programmes: Programme[];
  departments: Department[];
}) => {
  if (role === "dean") {
    return (
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Managed Programme (School) *
        </p>
        <select
          value={value.managed_programme ?? ""}
          onChange={(e) =>
            onChange({
              ...value,
              managed_programme: e.target.value ? Number(e.target.value) : null,
            })
          }
          className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">— Select school/programme —</option>
          {programmes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
    );
  }
  if (role === "dept_head") {
    return (
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Managed Department *
        </p>
        <select
          value={value.managed_department ?? ""}
          onChange={(e) =>
            onChange({
              ...value,
              managed_department: e.target.value
                ? Number(e.target.value)
                : null,
            })
          }
          className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">— Select department —</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
              {d.programme_name ? ` (${d.programme_name})` : ""}
            </option>
          ))}
        </select>
        {departments.length === 0 && (
          <p className="text-xs text-destructive mt-1">
            No departments yet. Go to Setup → Departments to create one first.
          </p>
        )}
      </div>
    );
  }
  return null;
};

const UserRolesTab = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  const [editOpen, setEditOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({
    username: "",
    staff_id: "",
    first_name: "",
    last_name: "",
    email: "",
    role: "",
    password: "",
    managed_programme: null as number | null,
    managed_department: null as number | null,
  });
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showEditPass, setShowEditPass] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    username: "",
    staff_id: "",
    first_name: "",
    last_name: "",
    email: "",
    role: "teacher",
    password: "",
    managed_programme: null as number | null,
    managed_department: null as number | null,
  });
  const [adding, setAdding] = useState(false);
  const [showAddPass, setShowAddPass] = useState(false);

  const [importOpen, setImportOpen] = useState(false);
  const [importType, setImportType] = useState<ImportType>("teachers");
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([
      getUsersApi(),
      getProgrammesApi({ active_only: true }),
      getDepartmentsApi({ active_only: true }),
      getOfferingsApi({}),
    ])
      .then(([usersRes, progsRes, departmentsRes, offeringsRes]) => {
        const offerings = offeringsRes.data;
        const usersWithCourses = usersRes.data.map((u: User) => {
          if (u.role === "teacher") {
            const courses = offerings
              .filter((o: any) => o.teacher === u.id)
              .map((o: any) => o.course_name);
            return { ...u, teaching_courses: courses };
          }
          return u;
        });
        setUsers(usersWithCourses);
        setProgrammes(progsRes.data);
        setDepartments(departmentsRes.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const openEdit = (user: User) => {
    setEditUser(user);
    setEditForm({
      username: user.username,
      staff_id: user.staff_id || "",
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      role: user.role,
      password: "",
      managed_programme: user.managed_programme ?? null,
      managed_department: user.managed_department ?? null,
    });
    setShowEditPass(false);
    setEditOpen(true);
  };

  const handleSave = async () => {
    if (!editUser) return;
    setSaving(true);
    try {
      const payload: any = {
        username: editForm.username,
        staff_id: editForm.staff_id,
        first_name: editForm.first_name,
        last_name: editForm.last_name,
        email: editForm.email,
        role: editForm.role,
        managed_programme_id: editForm.managed_programme,
        managed_department_id: editForm.managed_department,
      };
      if (editForm.password) payload.password = editForm.password;
      const res = await updateUserApi(editUser.id, payload);
      setUsers((prev) =>
        prev.map((u) => (u.id === editUser.id ? res.data : u)),
      );
      toast.success("User updated!");
      setEditOpen(false);
    } catch {
      toast.error("Failed to update user");
    } finally {
      setSaving(false);
    }
  };

  const handleResetAndCopy = async () => {
    if (!editUser) return;
    const newPassword = generatePassword();
    setResetting(true);
    try {
      await updateUserApi(editUser.id, { password: newPassword });
      await navigator.clipboard.writeText(newPassword);
      setEditForm((prev) => ({ ...prev, password: newPassword }));
      toast.success("Password reset and copied!");
    } catch {
      toast.error("Failed to reset password");
    } finally {
      setResetting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this user?")) return;
    try {
      await deleteUserApi(id);
      setUsers((prev) => prev.filter((u) => u.id !== id));
      toast.success("User deleted!");
    } catch {
      toast.error("Failed to delete user");
    }
  };

  const handleAdd = async () => {
    if (!addForm.username || !addForm.email || !addForm.password) {
      toast.error("Username, email and password are required");
      return;
    }
    setAdding(true);
    try {
      const res = await createUserApi({
        ...addForm,
        managed_programme_id: addForm.managed_programme,
        managed_department_id: addForm.managed_department,
      } as any);
      setUsers((prev) => [...prev, res.data]);
      toast.success("User created!");
      setAddOpen(false);
      setAddForm({
        username: "",
        staff_id: "",
        first_name: "",
        last_name: "",
        email: "",
        role: "teacher",
        password: "",
        managed_programme: null,
        managed_department: null,
      });
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Failed to create user");
    } finally {
      setAdding(false);
    }
  };

  const csvTemplates: Record<ImportType, { headers: string; example: string }> =
    {
      teachers: {
        headers: "first_name,last_name,staff_id,email,role,password(optional)",
        example: "John,Doe,TCH001,john@eau.edu.et,teacher,",
      },
      admins: {
        headers: "first_name,last_name,staff_id,email,role,password(optional)",
        example: "Jane,Smith,ADM001,jane@eau.edu.et,admin,",
      },
      students: {
        headers: "first_name,last_name,staff_id,email,role,password(optional)",
        example: "Alice,Lemma,UGR001,alice@eau.edu.et,student,",
      },
      parents: {
        headers: "first_name,last_name,email,role,password(optional)",
        example: "Abebe,Kebede,abebe@gmail.com,parent,",
      },
    };

  const downloadTemplate = () => {
    const tmpl = csvTemplates[importType];
    const csv = [tmpl.headers, tmpl.example].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${importType}_template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadCredentials = (credentials: ImportResult["credentials"]) => {
    const csv = [
      "name,email,username,password",
      ...credentials.map(
        (c) => `${c.name},${c.email},${c.username},${c.password}`,
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "imported_credentials.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResults(null);
    let rows: Record<string, string>[];
    try {
      rows = await parseFileToRows(file);
    } catch {
      toast.error("Failed to read file.");
      setImporting(false);
      return;
    }
    let created = 0;
    const errors: { row: number; error: string }[] = [];
    const credentials: ImportResult["credentials"] = [];
    const newUsers: User[] = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const isParent = importType === "parents";
      const username = isParent ? row.email : row.staff_id || row.email;
      if (!username || !row.email) {
        errors.push({ row: i + 2, error: "Missing required fields" });
        continue;
      }
      const password = row.password || generatePassword();
      try {
        const res = await createUserApi({
          username,
          staff_id: row.staff_id || "",
          first_name: row.first_name || "",
          last_name: row.last_name || "",
          email: row.email,
          role: row.role || importType.slice(0, -1),
          password,
        });
        newUsers.push(res.data);
        credentials.push({
          name: `${row.first_name || ""} ${row.last_name || ""}`.trim(),
          email: row.email,
          username,
          password,
        });
        created++;
      } catch (err: any) {
        errors.push({
          row: i + 2,
          error: err?.response?.data?.error || "Failed",
        });
      }
    }
    if (newUsers.length > 0) setUsers((prev) => [...prev, ...newUsers]);
    setImportResults({ created, errors, credentials });
    setImporting(false);
    if (fileRef.current) fileRef.current.value = "";
    if (created > 0) toast.success(`${created} users imported!`);
  };

  const scopeSummary = (u: User) => {
    if (u.role === "dean" && u.managed_programme_name)
      return u.managed_programme_name;
    if (u.role === "dept_head" && u.managed_department_name)
      return u.managed_department_name;
    if (u.role === "teacher") {
      if (u.teaching_courses && u.teaching_courses.length > 0)
        return u.teaching_courses.join(", ");
      return "No offerings yet";
    }
    return "—";
  };

  return (
    <>
      <Card className="shadow-card border-border/50">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-muted-foreground" />
              <CardTitle className="font-display text-base">
                User Roles
              </CardTitle>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => {
                  setImportResults(null);
                  setImportOpen(true);
                }}
              >
                <Upload className="w-4 h-4" /> Import CSV
              </Button>
              <Button
                size="sm"
                className="gap-1.5 bg-primary hover:bg-primary/90"
                onClick={() => setAddOpen(true)}
              >
                <Plus className="w-4 h-4" /> Add User
              </Button>
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
                  Username
                </th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                  Staff ID
                </th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                  Email
                </th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                  Role
                </th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                  Scope
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
                    Loading users...
                  </td>
                </tr>
              )}
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-6 py-4 font-medium">
                    {u.first_name} {u.last_name}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground font-mono text-xs">
                    {u.username}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground font-mono text-xs">
                    {u.staff_id || "—"}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">{u.email}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`text-xs font-medium px-2.5 py-1 rounded-full border capitalize ${roleStyles[u.role] || "bg-muted text-muted-foreground"}`}
                    >
                      {roleLabels[u.role] ?? u.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs text-muted-foreground">
                    {scopeSummary(u)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEdit(u)}
                        className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(u.id)}
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
            <DialogTitle className="font-display">Edit User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Username
                </p>
                <input
                  value={editForm.username}
                  onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                  className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Staff ID
                </p>
                <input
                  value={editForm.staff_id}
                  onChange={(e) => setEditForm({ ...editForm, staff_id: e.target.value })}
                  placeholder="e.g. TCH001"
                  className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
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
                Role
              </p>
              <select
                value={editForm.role}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    role: e.target.value,
                    managed_programme: null,
                    managed_department: null,
                  })
                }
                className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="teacher">Teacher</option>
                <option value="dept_head">Department Head</option>
                <option value="dean">Dean</option>
                <option value="admin">Admin</option>
                <option value="student">Student</option>
              </select>
            </div>
            <ScopeField
              role={editForm.role}
              value={editForm}
              onChange={(v) => setEditForm((prev) => ({ ...prev, ...v }))}
              programmes={programmes}
              departments={departments}
            />
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                New Password{" "}
                <span className="normal-case font-normal">
                  (leave blank to keep current)
                </span>
              </p>
              <div className="relative">
                <input
                  type={showEditPass ? "text" : "password"}
                  value={editForm.password}
                  onChange={(e) =>
                    setEditForm({ ...editForm, password: e.target.value })
                  }
                  placeholder="Enter new password..."
                  className="w-full border border-input rounded-lg px-3 py-2 pr-20 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      setEditForm({ ...editForm, password: generatePassword() })
                    }
                    className="p-1 text-muted-foreground hover:text-foreground"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowEditPass(!showEditPass)}
                    className="p-1 text-muted-foreground hover:text-foreground"
                  >
                    {showEditPass ? (
                      <EyeOff className="w-3.5 h-3.5" />
                    ) : (
                      <Eye className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            </div>
            <div className="flex justify-between gap-2 pt-2">
              <Button
                variant="outline"
                onClick={handleResetAndCopy}
                disabled={resetting}
                className="gap-1.5 text-muted-foreground"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${resetting ? "animate-spin" : ""}`}
                />{" "}
                {resetting ? "Resetting..." : "Reset & Copy"}
              </Button>
              <div className="flex gap-2">
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
          </div>
        </DialogContent>
      </Dialog>

      {/* Add User Modal */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Add New User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  First Name
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
                  Last Name
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
                  Username *
                </p>
                <input
                  value={addForm.username}
                  onChange={(e) =>
                    setAddForm({ ...addForm, username: e.target.value })
                  }
                  className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Staff ID
                </p>
                <input
                  value={addForm.staff_id}
                  onChange={(e) =>
                    setAddForm({ ...addForm, staff_id: e.target.value })
                  }
                  placeholder="e.g. TCH001"
                  className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
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
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Role *
              </p>
              <select
                value={addForm.role}
                onChange={(e) =>
                  setAddForm({
                    ...addForm,
                    role: e.target.value,
                    managed_programme: null,
                    managed_department: null,
                  })
                }
                className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="teacher">Teacher</option>
                <option value="dept_head">Department Head</option>
                <option value="dean">Dean</option>
                <option value="admin">Admin</option>
                <option value="student">Student</option>
              </select>
            </div>
            <ScopeField
              role={addForm.role}
              value={addForm}
              onChange={(v) => setAddForm((prev) => ({ ...prev, ...v }))}
              programmes={programmes}
              departments={departments}
            />
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Password *
              </p>
              <div className="relative">
                <input
                  type={showAddPass ? "text" : "password"}
                  value={addForm.password}
                  onChange={(e) =>
                    setAddForm({ ...addForm, password: e.target.value })
                  }
                  className="w-full border border-input rounded-lg px-3 py-2 pr-20 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      setAddForm({ ...addForm, password: generatePassword() })
                    }
                    className="p-1 text-muted-foreground hover:text-foreground"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddPass(!showAddPass)}
                    className="p-1 text-muted-foreground hover:text-foreground"
                  >
                    {showAddPass ? (
                      <EyeOff className="w-3.5 h-3.5" />
                    ) : (
                      <Eye className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
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
                {adding ? "Adding..." : "Add User"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import Modal */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">
              Import Users via CSV or Excel
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Import Type
              </p>
              <div className="grid grid-cols-2 gap-2">
                {(["teachers", "admins", "students", "parents"] as const).map(
                  (type) => (
                    <button
                      key={type}
                      onClick={() => setImportType(type)}
                      className={`px-4 py-2.5 rounded-lg text-sm font-medium border transition-all capitalize ${importType === type ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted"}`}
                    >
                      {type}
                    </button>
                  ),
                )}
              </div>
            </div>
            <div className="p-4 bg-muted/30 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Required columns:</p>
                <button
                  onClick={downloadTemplate}
                  className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                >
                  <Download className="w-3 h-3" /> Download template
                </button>
              </div>
              <p className="font-mono text-xs text-muted-foreground">
                {csvTemplates[importType].headers}
              </p>
              <p className="text-xs text-muted-foreground">
                Leave <span className="font-medium">password</span> blank to
                auto-generate.
              </p>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Upload CSV or Excel File
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleImport}
                disabled={importing}
                className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none"
              />
              {importing && (
                <p className="text-xs text-muted-foreground">
                  Importing users...
                </p>
              )}
            </div>
            {importResults && (
              <div
                className={`p-3 rounded-lg text-sm ${importResults.errors.length === 0 ? "bg-primary/10" : "bg-muted"}`}
              >
                <div className="flex items-center justify-between">
                  <p className="font-medium">
                    {importResults.created} users imported successfully
                  </p>
                  {importResults.credentials.length > 0 && (
                    <button
                      onClick={() =>
                        downloadCredentials(importResults.credentials)
                      }
                      className="flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
                    >
                      <Download className="w-3 h-3" /> Download credentials
                    </button>
                  )}
                </div>
                {importResults.errors.length > 0 && (
                  <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                    {importResults.errors.map((e, i) => (
                      <p key={i} className="text-xs text-destructive">
                        Row {e.row}: {e.error}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
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

export default UserRolesTab;