import axios from "axios";

const API_BASE_URL = "http://127.0.0.1:8000/api";
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// Prefer sessionStorage (per-tab) so each tab keeps its own session.
// Falls back to localStorage for tokens written before this fix.
const getToken = (key: string) =>
  sessionStorage.getItem(key) || localStorage.getItem(key);

const setToken = (key: string, value: string) => {
  sessionStorage.setItem(key, value);
  localStorage.setItem(key, value);
};

const clearTokens = () => {
  sessionStorage.clear();
  localStorage.clear();
};

api.interceptors.request.use((config) => {
  const token = getToken("access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refresh = getToken("refresh_token");
      if (refresh) {
        try {
          const res = await axios.post(`${API_BASE_URL}/auth/refresh/`, {
            refresh,
          });
          setToken("access_token", res.data.access);
          original.headers.Authorization = `Bearer ${res.data.access}`;
          return api(original);
        } catch {
          clearTokens();
          window.location.href = "/login";
        }
      } else {
        clearTokens();
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  },
);

// ── Auth ──────────────────────────────────────────────────────
export const loginApi = (username: string, password: string) =>
  api.post("/auth/login/", { username, password });
export const getMeApi = () => api.get("/auth/me/");

// ── Programmes ────────────────────────────────────────────────
export const getProgrammesApi = (params?: { active_only?: boolean }) =>
  api.get("/programmes/", { params });
export const createProgrammeApi = (data: {
  name: string;
  code?: string;
  duration_years?: number;
}) => api.post("/programmes/", data);
export const updateProgrammeApi = (id: number, data: any) =>
  api.patch(`/programmes/${id}/`, data);
export const deleteProgrammeApi = (id: number) =>
  api.delete(`/programmes/${id}/`);

// ── Courses (templates) ───────────────────────────────────────
export const getCoursesApi = (params?: {
  programme?: number;
  department?: number;
  year?: number;
  active_only?: boolean;
}) => api.get("/courses/", { params });
export const createCourseApi = (data: {
  name: string;
  code?: string;
  total_credit_hours: number;
  programme_id: number;
  year: number;
  minimum_attendance_percent?: number;
}) => api.post("/courses/", data);
export const updateCourseApi = (id: number, data: any) =>
  api.patch(`/courses/${id}/`, data);
export const deleteCourseApi = (id: number) => api.delete(`/courses/${id}/`);

// ── Academic Years ────────────────────────────────────────────
export const getAcademicYearsApi = () => api.get("/academic-years/");
export const createAcademicYearApi = (data: {
  name: string;
  start_date: string;
  end_date: string;
  is_current?: boolean;
}) => api.post("/academic-years/", data);
export const updateAcademicYearApi = (id: number, data: any) =>
  api.patch(`/academic-years/${id}/`, data);
export const deleteAcademicYearApi = (id: number) =>
  api.delete(`/academic-years/${id}/`);

// ── Semesters ─────────────────────────────────────────────────
export const getSemestersApi = (params?: {
  academic_year?: number;
  current?: boolean;
}) => api.get("/semesters/", { params });
export const createSemesterApi = (data: {
  academic_year_id: number;
  number: number;
  start_date: string;
  end_date: string;
  is_current?: boolean;
}) => api.post("/semesters/", data);
export const updateSemesterApi = (id: number, data: any) =>
  api.patch(`/semesters/${id}/`, data);
export const deleteSemesterApi = (id: number) =>
  api.delete(`/semesters/${id}/`);

// ── Sections ──────────────────────────────────────────────────
export const getSectionsApi = (params?: {
  semester?: number;
  programme?: number;
  year?: number;
}) => api.get("/sections/", { params });
export const createSectionApi = (data: {
  name: string;
  programme_id: number;
  year: number;
  semester_id: number;
}) => api.post("/sections/", data);
export const updateSectionApi = (id: number, data: any) =>
  api.patch(`/sections/${id}/`, data);
export const deleteSectionApi = (id: number) => api.delete(`/sections/${id}/`);

// ── Students ──────────────────────────────────────────────────
export const getStudentsApi = (params?: {
  programme?: number;
  semester?: number;
  section?: number;
  active_only?: boolean;
  search?: string;
  student_staff_id?: string;
}) => api.get("/students/", { params });
export const createStudentApi = (data: {
  first_name: string;
  last_name: string;
  student_id: string;
  email: string;
  parent_email?: string;
  parent_telegram?: string;
  programme_id?: number;
  section_id?: number;
}) => api.post("/students/", data);
export const updateStudentApi = (id: number, data: any) =>
  api.patch(`/students/${id}/`, data);
export const deleteStudentApi = (id: number) => api.delete(`/students/${id}/`);
export const bulkImportStudentsApi = (file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  return api.post("/students/import/", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

// ── Enrollments ───────────────────────────────────────────────
export const getEnrollmentsApi = (params?: {
  section?: number;
  student?: number;
  semester?: number;
  status?: string;
}) => api.get("/enrollments/", { params });
export const createEnrollmentApi = (data: {
  student_id: number;
  section_id: number;
}) => api.post("/enrollments/", data);
export const updateEnrollmentApi = (id: number, data: { status: string }) =>
  api.patch(`/enrollments/${id}/`, data);
export const deleteEnrollmentApi = (id: number) =>
  api.delete(`/enrollments/${id}/`);
export const bulkEnrollApi = (data: {
  section_id: number;
  student_ids: number[];
}) => api.post("/enrollments/bulk/", data);

// ── Course Offerings ──────────────────────────────────────────
export const getOfferingsApi = (params?: {
  semester?: number;
  section?: number;
  programme?: number;
  teacher?: number;
}) => api.get("/offerings/", { params });
export const createOfferingApi = (data: {
  course_id: number;
  section_id: number;
  teacher_id?: number;
  session_type?: string;
}) => api.post("/offerings/", data);
export const updateOfferingApi = (id: number, data: { teacher_id?: number; session_type?: string }) =>
  api.patch(`/offerings/${id}/`, data);
export const deleteOfferingApi = (id: number) =>
  api.delete(`/offerings/${id}/`);
export const getOfferingStudentsApi = (offeringId: number) =>
  api.get(`/offerings/${offeringId}/students/`);
export const getOfferingSummaryApi = (
  offeringId: number,
  params?: {
    type?: "full" | "weekly" | "custom";
    student?: number;
    start_date?: string;
    end_date?: string;
  },
) => api.get(`/offerings/${offeringId}/summary/`, { params });

// ── Attendance ────────────────────────────────────────────────
export const getAttendanceApi = (params?: {
  offering?: number;
  section?: number;
  semester?: number;
  programme?: number;
  student?: number;
  student_staff_id?: string;
  date?: string;
  search?: string;
}) => api.get("/attendance/", { params });
export const submitAttendanceApi = (data: {
  course_offering_id: number;
  date: string;
  session_type: string;
  session_hours: number;
  records: { student_id: number; status: string; comment?: string }[];
}) => api.post("/attendance/submit/", data);

// ── Dashboard ─────────────────────────────────────────────────
export const getStatsApi = (params?: { semester?: number }) =>
  api.get("/stats/", { params });
export const getAtRiskApi = (params?: {
  semester?: number;
  programme?: number;
}) => api.get("/at-risk/", { params });

// ── Users ─────────────────────────────────────────────────────
export const getUsersApi = (params?: { role?: string }) =>
  api.get("/users/", { params });
export const createUserApi = (data: {
  username: string;
  staff_id?: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  password: string;
}) => api.post("/users/", data);
export const updateUserApi = (id: number, data: any) =>
  api.patch(`/users/${id}/`, data);
export const deleteUserApi = (id: number) => api.delete(`/users/${id}/`);

// ── Notifications ─────────────────────────────────────────────
export const getNotificationsApi = () => api.get("/notifications/");
export const markNotificationReadApi = (id: number) =>
  api.post(`/notifications/${id}/read/`);

// ── Settings ──────────────────────────────────────────────────
export const getSettingsApi = () => api.get("/settings/");
export const updateSettingsApi = (data: any) => api.patch("/settings/", data);

// ── Departments ──────────────────────────────────────────────
export const getDepartmentsApi = (params?: {
  programme?: number;
  active_only?: boolean;
}) => api.get("/departments/", { params });
export const createDepartmentApi = (data: {
  name: string;
  code?: string;
  programme_id: number;
}) => api.post("/departments/", data);
export const updateDepartmentApi = (id: number, data: any) =>
  api.patch(`/departments/${id}/`, data);
export const deleteDepartmentApi = (id: number) =>
  api.delete(`/departments/${id}/`);

// ── Attendance Excel ──────────────────────────────────────────────────────────
export const downloadAttendanceTemplateApi = (
  offeringId: number,
  params?: { week_start?: string; start_date?: string; end_date?: string },
) =>
  api.get(`/attendance/template/${offeringId}/`, {
    params,
    responseType: "blob",
  });

export const previewAttendanceImportApi = (file: File) => {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("preview_only", "true");
  return api.post("/attendance/import/", fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

export const submitAttendanceImportApi = (file: File) => {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("preview_only", "false");
  return api.post("/attendance/import/", fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

// ── Reports ───────────────────────────────────────────────────
// Fixed: uses axios instead of raw fetch so the auth interceptor
// fires correctly. Raw fetch was bypassing the interceptor and
// sending a bad/missing token, causing Django to return 404.
export const downloadReportApi = async (
  type: "offering" | "student",
  id: number,
  format: "pdf" | "csv",
  reportType: "full" | "weekly" = "full",
  params?: {
    student?: number;
    offering?: number;
    start_date?: string;
    end_date?: string;
  },
) => {
  const token = getToken("access_token");
  if (!token) {
    throw new Error("Session expired. Please log in again.");
  }
  const url =
    type === "offering" ? `/reports/offering/${id}/` : `/reports/student/${id}/`;
  const response = await api.get(url, {
    params: {
      rpt_format: format,
      type: reportType,
      ...params,
    },
    headers: {
      Authorization: `Bearer ${token}`,
    },
    responseType: "blob",
  });

  const xlsxMime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  const blobType = format === "pdf" ? "application/pdf" : xlsxMime;
  const fileExt  = format === "pdf" ? "pdf" : "xlsx";
  const blob = new Blob([response.data], { type: blobType });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download =
    type === "offering"
      ? `offering_${id}_${reportType}.${fileExt}`
      : `student_${id}.${fileExt}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(objectUrl);
};

export const getSummaryReportApi = (params?: {
  semester?: number;
  programme?: number;
  department?: number;
  teacher?: number;
  start_date?: string;
  end_date?: string;
}) => api.get("/reports/summary/", { params });

export const downloadSummaryReportApi = async (
  format: "pdf" | "csv",
  params?: {
    semester?: number;
    programme?: number;
    department?: number;
    teacher?: number;
    start_date?: string;
    end_date?: string;
  },
) => {
  const token = getToken("access_token");
  if (!token) {
    throw new Error("Session expired. Please log in again.");
  }
  const response = await api.get("/reports/summary/", {
    params: { rpt_format: format, ...params },
    headers: {
      Authorization: `Bearer ${token}`,
    },
    responseType: "blob",
  });
  const xlsxMime2 = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  const blobType2 = format === "pdf" ? "application/pdf" : xlsxMime2;
  const fileExt2  = format === "pdf" ? "pdf" : "xlsx";
  const blob = new Blob([response.data], { type: blobType2 });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = `attendance_summary_overview.${fileExt2}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(objectUrl);
};

export default api;