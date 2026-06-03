import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminHeader from "@/components/admin/AdminHeader";
import StatsCards from "@/components/admin/StatsCards";
import AttendanceChart from "@/components/admin/AttendanceChart";
import StatusDistribution from "@/components/admin/StatusDistribution";
import AtRiskTable from "@/components/admin/AtRiskTable";
import RecentActivity from "@/components/admin/RecentActivity";
import CoursesTab from "@/components/admin/CoursesTab";
import ReportsTab from "@/components/admin/ReportsTab";
import NotificationsTab from "@/components/admin/NotificationsTab";
import StudentsTab from "@/components/admin/StudentsTab";
import AttendanceTab from "@/components/admin/AttendanceTab";
import UserRolesTab from "@/components/admin/UserRolesTab";
import SettingsTab from "@/components/admin/SettingsTab";
import SetupTab from "@/components/admin/SetupTab";
import {
  getCoursesApi,
  getStudentsApi,
  getNotificationsApi,
  markNotificationReadApi,
  getProgrammesApi,
  getStatsApi,
  getAtRiskApi,
  getSemestersApi,
} from "@/api/axios";

const tabTitles: Record<string, string> = {
  overview: "Dashboard Overview",
  students: "Student Management",
  courses: "Course Management",
  attendance: "Attendance Records",
  "at-risk": "At-Risk Students",
  "user-roles": "User Roles",
  reports: "Reports & Analytics",
  notifications: "Notifications",
  settings: "Settings",
  setup: "System Setup",
};

export interface Course {
  id: number;
  name: string;
  code: string;
  total_credit_hours: string;
  minimum_required_hours?: number;
  minimum_attendance_percent?: number;
  programme_name: string;
  year: number;
  semester?: number;
  is_active?: boolean;
}
export interface Programme {
  id: number;
  name: string;
  duration_years: number;
}
export interface Notification {
  id: number;
  message: string;
  notification_type: string;
  created_at: string;
}

const AdminDashboard = () => {
  const { user, role } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<
    { id: number; full_name: string; student_id: string }[]
  >([]);
  const [stats, setStats] = useState({
    total_students: 0,
    total_courses: 0,
    active_enrollments: 0,
    total_programmes: 0,
    status_distribution: { present: 0, late: 0, excused: 0, absent: 0 },
  });
  const [atRiskCount, setAtRiskCount] = useState(0);
  const [currentSemesterId, setCurrentSemesterId] = useState<
    number | undefined
  >();

  // Build scope filter params for dean and dept_head
  const scopeParams: Record<string, any> = (() => {
    if (!user) return {};
    const u = user as any;
    if (role === "dean" && u.managed_programme)
      return { programme: u.managed_programme };
    if (role === "dept_head") {
      // dept_head has managed_department_programme (the programme their dept belongs to)
      const progId = u.managed_department_programme || u.managed_programme;
      if (progId) return { programme: progId };
    }
    return {};
  })();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const semRes = await getSemestersApi({ current: true });
        const currentSemester = semRes.data?.[0];
        if (currentSemester) setCurrentSemesterId(currentSemester.id);
        const semId = currentSemester?.id;
        const baseParams = semId
          ? { semester: semId, ...scopeParams }
          : scopeParams;

        // Build programme-scoped params for courses and students
        const courseParams: Record<string, any> = { active_only: true };
        const studentParams: Record<string, any> = {};
        if (scopeParams.programme) {
          courseParams.programme = scopeParams.programme;
          studentParams.programme = scopeParams.programme;
        }

        const [
          coursesRes,
          studentsRes,
          notifRes,
          programmesRes,
          statsRes,
          atRiskRes,
        ] = await Promise.all([
          getCoursesApi(courseParams),
          getStudentsApi(studentParams),
          getNotificationsApi(),
          getProgrammesApi({ active_only: true }),
          getStatsApi(baseParams),
          getAtRiskApi(baseParams),
        ]);

        setCourses(coursesRes.data);
        setProgrammes(programmesRes.data);
        setStudents(studentsRes.data || []);
        setNotifications(notifRes.data.notifications || []);
        setStats(statsRes.data);
        setAtRiskCount(atRiskRes.data.count || 0);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleMarkRead = async (id: number) => {
    await markNotificationReadApi(id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const statusCounts = {
    present: stats.status_distribution?.present || 0,
    late: stats.status_distribution?.late || 0,
    exempted: stats.status_distribution?.excused || 0,
    absent: stats.status_distribution?.absent || 0,
  };

  return (
    <div className="flex min-h-screen bg-background">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-foreground/20 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <div
        className={`fixed inset-y-0 left-0 z-50 lg:hidden transform transition-transform duration-300 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <AdminSidebar
          activeTab={activeTab}
          onTabChange={(tab) => {
            setActiveTab(tab);
            setSidebarOpen(false);
          }}
          notificationCount={notifications.length}
        />
      </div>

      <AdminSidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        collapsed={sidebarCollapsed}
        onCollapse={setSidebarCollapsed}
        notificationCount={notifications.length}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader
          title={tabTitles[activeTab] || "Dashboard"}
          onMenuToggle={() => setSidebarOpen(true)}
          notifications={notifications}
          onMarkRead={handleMarkRead}
          onNavigate={setActiveTab}
          students={students}
          courses={courses}
        />

        <main className="flex-1 p-4 lg:p-6 space-y-6 overflow-auto">
          {activeTab === "overview" && (
            <>
              <StatsCards
                totalStudents={stats.total_students}
                totalCourses={stats.total_courses}
                atRiskCount={atRiskCount}
                totalRecords={stats.active_enrollments}
              />
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <AttendanceChart />
                </div>
                <StatusDistribution
                  present={statusCounts.present}
                  late={statusCounts.late}
                  exempted={statusCounts.exempted}
                  absent={statusCounts.absent}
                />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <AtRiskTable semesterId={currentSemesterId} scopeParams={scopeParams} />
                </div>
                <RecentActivity notifications={notifications} />
              </div>
            </>
          )}
          {activeTab === "students" && <StudentsTab programmes={programmes} scopeParams={scopeParams} />}
          {activeTab === "courses" && (
            <CoursesTab
              courses={courses}
              programmes={programmes}
              onCoursesChange={setCourses}
            />
          )}
          {activeTab === "attendance" && (
            <AttendanceTab courses={courses} programmes={programmes} />
          )}
          {activeTab === "at-risk" && (
            <AtRiskTable semesterId={currentSemesterId} fullPage scopeParams={scopeParams} />
          )}
          {activeTab === "user-roles" && <UserRolesTab />}
          {activeTab === "reports" && <ReportsTab courses={courses} />}
          {activeTab === "notifications" && (
            <NotificationsTab
              notifications={notifications}
              onMarkRead={handleMarkRead}
            />
          )}
          {activeTab === "settings" && <SettingsTab />}
          {activeTab === "setup" && <SetupTab />}
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;