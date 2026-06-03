from . import views_excel
from django.urls import path
from . import views
from rest_framework_simplejwt.views import TokenRefreshView

urlpatterns = [
    # ── Auth ──────────────────────────────────────────
    path('auth/login/',   views.LoginView.as_view()),
    path('auth/me/',      views.MeView.as_view()),
    path('auth/refresh/', TokenRefreshView.as_view()),

    # ── Programmes (Schools/Faculties) ────────────────
    path('programmes/',                      views.ProgrammeListView.as_view()),
    path('programmes/<int:programme_id>/',   views.ProgrammeDetailView.as_view()),

    # ── Departments ───────────────────────────────────
    path('departments/',                     views.DepartmentListView.as_view()),
    path('departments/<int:dept_id>/',       views.DepartmentDetailView.as_view()),

    # ── Courses ───────────────────────────────────────
    path('courses/',                         views.CourseListView.as_view()),
    path('courses/<int:course_id>/',         views.CourseDetailView.as_view()),

    # ── Academic Years ────────────────────────────────
    path('academic-years/',                  views.AcademicYearListView.as_view()),
    path('academic-years/<int:year_id>/',    views.AcademicYearDetailView.as_view()),

    # ── Semesters ─────────────────────────────────────
    path('semesters/',                       views.SemesterListView.as_view()),
    path('semesters/<int:semester_id>/',     views.SemesterDetailView.as_view()),

    # ── Sections ──────────────────────────────────────
    path('sections/',                        views.SectionListView.as_view()),
    path('sections/<int:section_id>/',       views.SectionDetailView.as_view()),

    # ── Students (static before parameterised) ────────
    path('students/',                        views.StudentListView.as_view()),
    path('students/import/',                 views.StudentBulkImportView.as_view()),
    path('students/<int:student_id>/',       views.StudentDetailView.as_view()),

    # ── Enrollments ───────────────────────────────────
    path('enrollments/',                     views.EnrollmentListView.as_view()),
    path('enrollments/bulk/',                views.BulkEnrollView.as_view()),
    path('enrollments/<int:enrollment_id>/', views.EnrollmentDetailView.as_view()),

    # ── Course Offerings ──────────────────────────────
    path('offerings/',                               views.CourseOfferingListView.as_view()),
    path('offerings/<int:offering_id>/',             views.CourseOfferingDetailView.as_view()),
    path('offerings/<int:offering_id>/students/',    views.CourseOfferingStudentsView.as_view()),
    path('offerings/<int:offering_id>/summary/',     views.CourseOfferingSummaryView.as_view()),

    # ── Attendance ────────────────────────────────────
    path('attendance/',                             views.AttendanceListView.as_view()),
    path('attendance/submit/',                      views.AttendanceSubmitView.as_view()),
    path('attendance/template/<int:offering_id>/',  views_excel.AttendanceTemplateView.as_view()),
    path('attendance/import/',                      views_excel.AttendanceImportView.as_view()),

    # ── Dashboard ─────────────────────────────────────
    path('stats/',    views.StatsView.as_view()),
    path('at-risk/',  views.AtRiskView.as_view()),

    # ── Users ─────────────────────────────────────────
    path('users/',                 views.UserListView.as_view()),
    path('users/<int:user_id>/',   views.UserDetailView.as_view()),

    # ── Notifications ─────────────────────────────────
    path('notifications/',                              views.NotificationListView.as_view()),
    path('notifications/<int:notification_id>/read/',   views.NotificationMarkReadView.as_view()),

    # ── Settings ──────────────────────────────────────
    path('settings/', views.SystemSettingsView.as_view()),

    # ── Reports ───────────────────────────────────────
    path('reports/offering/<int:offering_id>/', views.CourseOfferingReportView.as_view()),
    path('reports/student/<int:student_id>/',   views.StudentReportView.as_view()),
    path('reports/summary/',                     views.SummaryReportView.as_view()),
]