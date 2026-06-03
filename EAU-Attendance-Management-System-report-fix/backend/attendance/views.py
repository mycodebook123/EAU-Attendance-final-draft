import csv
import io
from decimal import Decimal
from datetime import date, timedelta
import datetime
from collections import defaultdict

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from django.contrib.auth.hashers import make_password
from django.db.models import Sum, Q, Avg
from django.http import HttpResponse

from .models import (
    User, Programme, Department, Course, AcademicYear, Semester,
    Section, Student, Enrollment, CourseOffering,
    AttendanceRecord, Notification, SystemSettings
)
from .serializers import (
    UserSerializer, LoginSerializer, ProgrammeSerializer,
    DepartmentSerializer, CourseSerializer, AcademicYearSerializer,
    SemesterSerializer, SectionSerializer, StudentSerializer,
    EnrollmentSerializer, CourseOfferingSerializer,
    AttendanceRecordSerializer, AttendanceSubmitSerializer,
    NotificationSerializer, SystemSettingsSerializer
)
from .utils import send_absence_alert, send_threshold_warning
from .reports import (
    generate_course_pdf,
    generate_course_csv, generate_student_pdf, generate_student_csv,
    get_offering_student_report_data, build_offering_report_aggregates,
    generate_offering_filtered_csv,
    generate_summary_overview_csv, generate_summary_overview_pdf,
    calc_attendance, is_gate_open, LATE_DEDUCTION, ACTIVATION_THRESHOLD,
)
# get_course_offering_summary is now internal to reports.py


# ─────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────
def is_admin(user):
    return user.role == 'admin' or user.is_superuser


def is_elevated(user):
    return user.role in ('admin', 'dean', 'dept_head') or user.is_superuser


def get_programme_ids(user):
    """
    Returns list of Programme IDs the user can access, or None for unrestricted.

    Dean     → their one managed_programme
    Dept Head → the programme their managed_department belongs to
    Admin     → None (unrestricted)
    Others    → [] (no elevated access)
    """
    if user.role == 'admin' or user.is_superuser:
        return None
    if user.role == 'dean' and user.managed_programme_id:
        return [user.managed_programme_id]
    if user.role == 'dept_head' and user.managed_department_id:
        # Dept head's programme = the programme their department belongs to
        return [user.managed_department.programme_id]
    return []


def get_department_ids(user):
    """
    Returns list of Department IDs the user can access, or None for unrestricted.

    Dean      → all departments in their programme
    Dept Head → only their one department
    Admin     → None (unrestricted)
    Others    → [] (no access)
    """
    if user.role == 'admin' or user.is_superuser:
        return None
    if user.role == 'dean' and user.managed_programme_id:
        return list(
            Department.objects.filter(
                programme_id=user.managed_programme_id, is_active=True
            ).values_list('id', flat=True)
        )
    if user.role == 'dept_head' and user.managed_department_id:
        return [user.managed_department_id]
    return []


def apply_programme_scope(qs, user, programme_field='programme_id'):
    """Filter queryset to programmes accessible to the user."""
    ids = get_programme_ids(user)
    if ids is None:
        return qs
    if not ids:
        return qs.none()
    return qs.filter(**{f'{programme_field}__in': ids})


def apply_department_scope(qs, user, dept_field='department_id'):
    """
    Filter queryset by department scope.
    For courses: dept_head sees courses in their dept OR courses with no dept
    in their programme. Dean sees all courses in their programme.
    """
    if user.role == 'admin' or user.is_superuser:
        return qs
    prog_ids = get_programme_ids(user)
    if not prog_ids:
        return qs.none()
    if user.role == 'dean':
        # Dean sees everything in their programme
        return qs.filter(programme_id__in=prog_ids)
    if user.role == 'dept_head' and user.managed_department_id:
        # Dept head ONLY sees courses explicitly assigned to their department
        return qs.filter(**{dept_field: user.managed_department_id})
    return qs.none()


def notify_elevated(notification_type, message, programme=None):
    """
    Notify all elevated users (admin, dean, dept_head) tagged with programme.
    Dept heads are notified only if the programme matches their department's programme.
    """
    q = Q(role='admin') | Q(is_superuser=True)
    if programme:
        q |= Q(role='dean', managed_programme=programme)
        q |= Q(role='dept_head', managed_department__programme=programme)
    recipients = User.objects.filter(q).distinct()
    for u in recipients:
        Notification.objects.create(
            recipient=u,
            notification_type=notification_type,
            message=message,
            programme=programme,
        )


def parse_report_date(value):
    if not value:
        return None
    try:
        return datetime.date.fromisoformat(value)
    except ValueError:
        return None


def build_summary_payload(user, params):
    semester_id = params.get('semester')
    programme_id = params.get('programme')
    department_id = params.get('department')
    teacher_id = params.get('teacher')
    start_date = parse_report_date(params.get('start_date'))
    end_date = parse_report_date(params.get('end_date'))

    current_sem = None
    if semester_id:
        current_sem = Semester.objects.filter(id=semester_id).first()
    else:
        current_sem = Semester.objects.filter(is_current=True).first()

    offerings = CourseOffering.objects.select_related(
        'course__department',
        'section__programme',
        'section__semester',
        'teacher',
    ).all()
    offerings = apply_programme_scope(offerings, user, 'section__programme_id')
    if current_sem:
        offerings = offerings.filter(section__semester=current_sem)
    if programme_id:
        offerings = offerings.filter(section__programme_id=programme_id)
    if department_id:
        offerings = offerings.filter(course__department_id=department_id)
    if teacher_id:
        offerings = offerings.filter(teacher_id=teacher_id)

    settings = SystemSettings.get()
    at_risk_thr = float(settings.at_risk_threshold)
    warning_thr = float(settings.warning_threshold)

    if start_date and end_date and end_date >= start_date:
        period_days = (end_date - start_date).days + 1
        prev_end = start_date - timedelta(days=1)
        prev_start = prev_end - timedelta(days=period_days - 1)
    else:
        prev_start = None
        prev_end = None

    offering_rows = []
    all_student_ids = set()
    risk_totals = {'safe': 0, 'warning': 0, 'at_risk': 0}
    trend_map = defaultdict(list)

    for offering in offerings:
        enrollments = Enrollment.objects.filter(
            section=offering.section,
            status='active',
        ).select_related('student')
        students = [e.student for e in enrollments]
        if not students:
            continue

        student_pcts = []
        at_risk_count = 0
        warning_count = 0
        for student in students:
            all_student_ids.add(student.id)
            records = AttendanceRecord.objects.filter(
                student=student,
                course_offering=offering,
            )
            if start_date:
                records = records.filter(date__gte=start_date)
            if end_date:
                records = records.filter(date__lte=end_date)

            present = records.filter(status='present').aggregate(
                total=Sum('hours_attended')
            )['total'] or Decimal('0')
            late = records.filter(status='late').aggregate(
                total=Sum('hours_attended')
            )['total'] or Decimal('0')
            absent_qs  = records.filter(status='absent')
            excused_qs = records.filter(status='excused')
            absent  = absent_qs.aggregate(total=Sum('hours_attended'))['total'] or Decimal('0')
            excused = excused_qs.aggregate(total=Sum('hours_attended'))['total'] or Decimal('0')
            if absent_qs.exists() and absent == 0:
                fallback = records.filter(status__in=['present','late'],
                    hours_attended__gt=0).aggregate(avg=Avg('hours_attended'))['avg'] or Decimal('1.0')
                absent = fallback * Decimal(absent_qs.count())
            if excused_qs.exists() and excused == 0:
                fallback = records.filter(status__in=['present','late'],
                    hours_attended__gt=0).aggregate(avg=Avg('hours_attended'))['avg'] or Decimal('1.0')
                excused = fallback * Decimal(excused_qs.count())
            attended = present + late
            # Excused excluded from gate and denominator
            total_logged = attended + absent
            total_credit = Decimal(str(offering.course.total_credit_hours))
            effective_credit = max(total_credit - excused, Decimal('1'))
            late_count_summary = AttendanceRecord.objects.filter(
                student=student,
                course_offering=offering,
                status='late',
            ).count()
            earned, pct = calc_attendance(present, late, effective_credit, late_count_summary)
            student_pcts.append(pct)

            gate = is_gate_open(total_logged, total_credit)
            if gate and pct < at_risk_thr:
                at_risk_count += 1
                risk_totals['at_risk'] += 1
            elif gate and pct < warning_thr:
                warning_count += 1
                risk_totals['warning'] += 1
            else:
                risk_totals['safe'] += 1

        avg_pct = round(sum(student_pcts) / len(student_pcts), 1) if student_pcts else 0.0

        prev_avg_pct = None
        if prev_start and prev_end:
            prev_pcts = []
            for student in students:
                prev_records = AttendanceRecord.objects.filter(
                    student=student,
                    course_offering=offering,
                    date__gte=prev_start,
                    date__lte=prev_end,
                )
                prev_present = prev_records.filter(status='present').aggregate(
                    total=Sum('hours_attended')
                )['total'] or Decimal('0')
                prev_late = prev_records.filter(status='late').aggregate(
                    total=Sum('hours_attended')
                )['total'] or Decimal('0')
                prev_missed_qs = prev_records.filter(status__in=['absent', 'excused'])
                prev_miss = prev_missed_qs.aggregate(total=Sum('hours_attended'))['total'] or Decimal('0')
                if prev_missed_qs.exists() and prev_miss == 0:
                    fallback = prev_records.filter(
                        status__in=['present', 'late'],
                        hours_attended__gt=0,
                    ).aggregate(avg=Avg('hours_attended'))['avg'] or Decimal('1.0')
                    prev_miss = fallback * Decimal(prev_missed_qs.count())
                prev_att = prev_present + prev_late
                prev_total_logged = prev_att + prev_miss
                prev_total_credit = Decimal(str(offering.course.total_credit_hours))
                _, prev_pct = calc_attendance(prev_present, prev_late, prev_total_credit)
                prev_pcts.append(prev_pct)
            prev_avg_pct = round(sum(prev_pcts) / len(prev_pcts), 1) if prev_pcts else None

        trend_delta = round(avg_pct - prev_avg_pct, 1) if prev_avg_pct is not None else 0.0
        trend_label = (
            "up" if trend_delta > 0 else "down" if trend_delta < 0 else "flat"
        )

        all_records = AttendanceRecord.objects.filter(course_offering=offering)
        if start_date:
            all_records = all_records.filter(date__gte=start_date)
        if end_date:
            all_records = all_records.filter(date__lte=end_date)
        for rec in all_records.values('date', 'status', 'hours_attended'):
            week = rec['date'] - datetime.timedelta(days=rec['date'].weekday())
            trend_map[week].append(rec)

        offering_rows.append({
            'offering_id': offering.id,
            'offering_label': f"{offering.course.name} — Sec {offering.section.name} Y{offering.section.year}",
            'programme_name': offering.section.programme.name,
            'department_name': offering.course.department.name if offering.course.department else '—',
            'student_count': len(students),
            'average_attendance': avg_pct,
            'at_risk_count': at_risk_count,
            'warning_count': warning_count,
            'trend_delta': trend_delta,
            'trend': trend_label,
        })

    offering_rows.sort(key=lambda x: x['average_attendance'])
    bottom_five = offering_rows[:5]
    top_five = list(reversed(offering_rows[-5:])) if offering_rows else []

    attendance_trend = []
    for week_start in sorted(trend_map.keys()):
        recs = trend_map[week_start]
        present = sum(float(r['hours_attended']) for r in recs if r['status'] == 'present')
        late = sum(float(r['hours_attended']) for r in recs if r['status'] == 'late')
        attended = present + late
        missed_raw = [float(r['hours_attended']) for r in recs if r['status'] in ('absent', 'excused')]
        missed = sum(missed_raw)
        if missed == 0 and missed_raw:
            attended_vals = [float(r['hours_attended']) for r in recs if r['status'] in ('present', 'late') and float(r['hours_attended']) > 0]
            fallback = (sum(attended_vals) / len(attended_vals)) if attended_vals else 1.0
            missed = fallback * len(missed_raw)
        total = attended + missed
        # For trend we use total_credit of first offering as approximation;
        # trend is relative so the denominator is consistent week-to-week.
        # We reuse the last offering's credit hours from the outer loop.
        earned = present + max(late - 0.5, 0.0)
        avg = round((earned / total * 100) if total > 0 else 0.0, 1)
        attendance_trend.append({
            'period': str(week_start),
            'average_attendance': avg,
        })

    avg_all = round(
        sum(r['average_attendance'] for r in offering_rows) / len(offering_rows),
        1,
    ) if offering_rows else 0.0
    worst = offering_rows[0] if offering_rows else None

    return {
        'filters': {
            'semester': current_sem.id if current_sem else None,
            'programme': int(programme_id) if programme_id else None,
            'department': int(department_id) if department_id else None,
            'teacher': int(teacher_id) if teacher_id else None,
            'start_date': str(start_date) if start_date else None,
            'end_date': str(end_date) if end_date else None,
        },
        'kpis': {
            'total_offerings': len(offering_rows),
            'total_students': len(all_student_ids),
            'overall_average_attendance': avg_all,
            'total_at_risk_students': risk_totals['at_risk'],
            'worst_offering_name': worst['offering_label'] if worst else 'N/A',
        },
        'risk_distribution': {
            'Safe': risk_totals['safe'],
            'Warning': risk_totals['warning'],
            'At Risk': risk_totals['at_risk'],
        },
        'attendance_trend': attendance_trend,
        'top_offerings': top_five,
        'bottom_offerings': bottom_five,
        'offering_analytics': offering_rows,
    }


# ─────────────────────────────────────────
# AUTH
# ─────────────────────────────────────────
class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        identifier = (request.data.get('username') or
                      request.data.get('staff_id') or
                      request.data.get('email'))
        password = request.data.get('password')
        if not identifier or not password:
            return Response({'error': 'Credentials required'},
                            status=status.HTTP_400_BAD_REQUEST)

        user = authenticate(username=identifier, password=password)
        if not user:
            try:
                found = User.objects.get(staff_id=identifier)
                user = authenticate(username=found.username, password=password)
            except User.DoesNotExist:
                pass
        if not user:
            try:
                found = User.objects.get(email=identifier)
                user = authenticate(username=found.username, password=password)
            except User.DoesNotExist:
                pass

        if not user:
            return Response({'error': 'Invalid credentials'},
                            status=status.HTTP_401_UNAUTHORIZED)

        refresh = RefreshToken.for_user(user)
        refresh['user_id'] = int(user.id)
        return Response({
            'access':  str(refresh.access_token),
            'refresh': str(refresh),
            'user':    UserSerializer(user).data
        })


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


# ─────────────────────────────────────────
# PROGRAMMES  (= Schools/Faculties in EAU)
# ─────────────────────────────────────────
class ProgrammeListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        programmes = Programme.objects.all()
        programmes = apply_programme_scope(programmes, request.user, 'id')
        if request.query_params.get('active_only'):
            programmes = programmes.filter(is_active=True)
        return Response(ProgrammeSerializer(programmes, many=True).data)

    def post(self, request):
        if not is_admin(request.user):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        name = request.data.get('name')
        if not name:
            return Response({'error': 'name is required'}, status=status.HTTP_400_BAD_REQUEST)
        programme = Programme.objects.create(
            name=name,
            code=request.data.get('code', ''),
            duration_years=request.data.get('duration_years', 4),
        )
        return Response(ProgrammeSerializer(programme).data, status=status.HTTP_201_CREATED)


class ProgrammeDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, programme_id):
        if not is_admin(request.user):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        try:
            programme = Programme.objects.get(id=programme_id)
        except Programme.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        for field in ['name', 'code', 'duration_years', 'is_active']:
            if field in request.data:
                setattr(programme, field, request.data[field])
        programme.save()
        return Response(ProgrammeSerializer(programme).data)

    def delete(self, request, programme_id):
        if not is_admin(request.user):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        try:
            programme = Programme.objects.get(id=programme_id)
            programme.is_active = False
            programme.save()
            return Response({'message': 'Programme deactivated'})
        except Programme.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)


# ─────────────────────────────────────────
# DEPARTMENTS
# ─────────────────────────────────────────
class DepartmentListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        departments = Department.objects.select_related('programme').all()
        # Scope: dean sees their programme's depts, dept_head sees their own
        prog_ids = get_programme_ids(request.user)
        if prog_ids is not None:
            departments = departments.filter(programme_id__in=prog_ids)
        if request.query_params.get('programme'):
            departments = departments.filter(
                programme_id=request.query_params['programme']
            )
        if request.query_params.get('active_only'):
            departments = departments.filter(is_active=True)
        return Response(DepartmentSerializer(departments, many=True).data)

    def post(self, request):
        if not is_admin(request.user):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        name = request.data.get('name')
        programme_id = request.data.get('programme_id')
        if not name or not programme_id:
            return Response({'error': 'name and programme_id are required'},
                            status=status.HTTP_400_BAD_REQUEST)
        try:
            programme = Programme.objects.get(id=programme_id)
        except Programme.DoesNotExist:
            return Response({'error': 'Programme not found'},
                            status=status.HTTP_404_NOT_FOUND)
        dept = Department.objects.create(
            name=name,
            code=request.data.get('code', ''),
            programme=programme,
        )
        return Response(DepartmentSerializer(dept).data, status=status.HTTP_201_CREATED)


class DepartmentDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, dept_id):
        if not is_admin(request.user):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        try:
            dept = Department.objects.get(id=dept_id)
        except Department.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        for field in ['name', 'code', 'is_active']:
            if field in request.data:
                setattr(dept, field, request.data[field])
        dept.save()
        return Response(DepartmentSerializer(dept).data)

    def delete(self, request, dept_id):
        if not is_admin(request.user):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        try:
            dept = Department.objects.get(id=dept_id)
            dept.is_active = False
            dept.save()
            return Response({'message': 'Department deactivated'})
        except Department.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)


# ─────────────────────────────────────────
# COURSES
# ─────────────────────────────────────────
class CourseListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        courses = Course.objects.select_related('programme', 'department').all()
        courses = apply_department_scope(courses, request.user, 'department_id')
        if request.query_params.get('programme'):
            courses = courses.filter(programme_id=request.query_params['programme'])
        if request.query_params.get('department'):
            courses = courses.filter(department_id=request.query_params['department'])
        if request.query_params.get('year'):
            courses = courses.filter(year=request.query_params['year'])
        if request.query_params.get('active_only'):
            courses = courses.filter(is_active=True)
        return Response(CourseSerializer(courses, many=True).data)

    def post(self, request):
        if not is_admin(request.user):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        required = ['name', 'total_credit_hours', 'programme_id']
        for f in required:
            if not request.data.get(f):
                return Response({'error': f'{f} is required'},
                                status=status.HTTP_400_BAD_REQUEST)
        try:
            programme = Programme.objects.get(id=request.data['programme_id'])
        except Programme.DoesNotExist:
            return Response({'error': 'Programme not found'},
                            status=status.HTTP_404_NOT_FOUND)
        department = None
        if request.data.get('department_id'):
            try:
                department = Department.objects.get(id=request.data['department_id'])
            except Department.DoesNotExist:
                return Response({'error': 'Department not found'},
                                status=status.HTTP_404_NOT_FOUND)
        course = Course.objects.create(
            name=request.data['name'],
            code=request.data.get('code', ''),
            programme=programme,
            department=department,
            year=request.data.get('year', 1),
            total_credit_hours=request.data['total_credit_hours'],
            minimum_attendance_percent=request.data.get(
                'minimum_attendance_percent', 85.0),
        )
        return Response(CourseSerializer(course).data, status=status.HTTP_201_CREATED)


class CourseDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, course_id):
        if not is_admin(request.user):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        try:
            course = Course.objects.get(id=course_id)
        except Course.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        for field in ['name', 'code', 'year', 'total_credit_hours',
                      'minimum_attendance_percent', 'is_active']:
            if field in request.data:
                setattr(course, field, request.data[field])
        if 'department_id' in request.data:
            did = request.data['department_id']
            course.department = Department.objects.filter(id=did).first() if did else None
        if 'programme_id' in request.data:
            pid = request.data['programme_id']
            if pid:
                try:
                    course.programme = Programme.objects.get(id=pid)
                except Programme.DoesNotExist:
                    return Response({'error': 'Programme not found'},
                                    status=status.HTTP_404_NOT_FOUND)
        course.save()
        return Response(CourseSerializer(course).data)

    def delete(self, request, course_id):
        if not is_admin(request.user):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        try:
            course = Course.objects.get(id=course_id)
            course.is_active = False
            course.save()
            return Response({'message': 'Course deactivated'})
        except Course.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)


# ─────────────────────────────────────────
# ACADEMIC YEARS
# ─────────────────────────────────────────
class AcademicYearListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        years = AcademicYear.objects.all()
        return Response(AcademicYearSerializer(years, many=True).data)

    def post(self, request):
        if not is_admin(request.user):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        required = ['name', 'start_date', 'end_date']
        for f in required:
            if not request.data.get(f):
                return Response({'error': f'{f} is required'},
                                status=status.HTTP_400_BAD_REQUEST)
        year = AcademicYear.objects.create(
            name=request.data['name'],
            start_date=request.data['start_date'],
            end_date=request.data['end_date'],
            is_current=request.data.get('is_current', False),
        )
        return Response(AcademicYearSerializer(year).data, status=status.HTTP_201_CREATED)


class AcademicYearDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, year_id):
        if not is_admin(request.user):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        try:
            year = AcademicYear.objects.get(id=year_id)
        except AcademicYear.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        for field in ['name', 'start_date', 'end_date', 'is_current']:
            if field in request.data:
                setattr(year, field, request.data[field])
        year.save()
        return Response(AcademicYearSerializer(year).data)

    def delete(self, request, year_id):
        if not is_admin(request.user):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        try:
            year = AcademicYear.objects.get(id=year_id)
            year.delete()
            return Response({'message': 'Academic year deleted'})
        except AcademicYear.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)


# ─────────────────────────────────────────
# SEMESTERS
# ─────────────────────────────────────────
class SemesterListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        semesters = Semester.objects.select_related('academic_year').all()
        if request.query_params.get('academic_year'):
            semesters = semesters.filter(
                academic_year_id=request.query_params['academic_year'])
        if request.query_params.get('current'):
            semesters = semesters.filter(is_current=True)
        return Response(SemesterSerializer(semesters, many=True).data)

    def post(self, request):
        if not is_admin(request.user):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        required = ['academic_year_id', 'number', 'start_date', 'end_date']
        for f in required:
            if not request.data.get(f):
                return Response({'error': f'{f} is required'},
                                status=status.HTTP_400_BAD_REQUEST)
        try:
            academic_year = AcademicYear.objects.get(id=request.data['academic_year_id'])
        except AcademicYear.DoesNotExist:
            return Response({'error': 'Academic year not found'},
                            status=status.HTTP_404_NOT_FOUND)
        semester = Semester.objects.create(
            academic_year=academic_year,
            number=request.data['number'],
            start_date=request.data['start_date'],
            end_date=request.data['end_date'],
            is_current=request.data.get('is_current', False),
        )
        return Response(SemesterSerializer(semester).data, status=status.HTTP_201_CREATED)


class SemesterDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, semester_id):
        if not is_admin(request.user):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        try:
            semester = Semester.objects.get(id=semester_id)
        except Semester.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        for field in ['number', 'start_date', 'end_date', 'is_current']:
            if field in request.data:
                setattr(semester, field, request.data[field])
        semester.save()
        return Response(SemesterSerializer(semester).data)

    def delete(self, request, semester_id):
        if not is_admin(request.user):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        try:
            semester = Semester.objects.get(id=semester_id)
            semester.delete()
            return Response({'message': 'Semester deleted'})
        except Semester.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)


# ─────────────────────────────────────────
# SECTIONS
# ─────────────────────────────────────────
class SectionListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        sections = Section.objects.select_related(
            'programme', 'semester__academic_year').all()
        sections = apply_programme_scope(sections, request.user, 'programme_id')
        if request.query_params.get('semester'):
            sections = sections.filter(semester_id=request.query_params['semester'])
        if request.query_params.get('programme'):
            sections = sections.filter(programme_id=request.query_params['programme'])
        if request.query_params.get('year'):
            sections = sections.filter(year=request.query_params['year'])
        return Response(SectionSerializer(sections, many=True).data)

    def post(self, request):
        if not is_admin(request.user):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        required = ['name', 'programme_id', 'year', 'semester_id']
        for f in required:
            if not request.data.get(f):
                return Response({'error': f'{f} is required'},
                                status=status.HTTP_400_BAD_REQUEST)
        try:
            programme = Programme.objects.get(id=request.data['programme_id'])
            semester = Semester.objects.get(id=request.data['semester_id'])
        except (Programme.DoesNotExist, Semester.DoesNotExist) as e:
            return Response({'error': str(e)}, status=status.HTTP_404_NOT_FOUND)
        section, created = Section.objects.get_or_create(
            name=request.data['name'],
            programme=programme,
            year=request.data['year'],
            semester=semester,
        )
        return Response(SectionSerializer(section).data,
                        status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class SectionDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, section_id):
        if not is_admin(request.user):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        try:
            section = Section.objects.get(id=section_id)
        except Section.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        for field in ['name', 'year']:
            if field in request.data:
                setattr(section, field, request.data[field])
        section.save()
        return Response(SectionSerializer(section).data)

    def delete(self, request, section_id):
        if not is_admin(request.user):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        try:
            section = Section.objects.get(id=section_id)
            section.delete()
            return Response({'message': 'Section deleted'})
        except Section.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)


# ─────────────────────────────────────────
# STUDENTS
# ─────────────────────────────────────────
class StudentListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        students = Student.objects.select_related('programme').all()
        # Scope: filter by student.programme OR by enrolled section's programme.
        # Using enrollment path is more reliable (students may have programme=NULL).
        prog_ids = get_programme_ids(request.user)
        if prog_ids is not None:
            if not prog_ids:
                students = students.none()
            else:
                students = students.filter(
                    Q(programme_id__in=prog_ids) |
                    Q(enrollments__section__programme_id__in=prog_ids,
                      enrollments__status='active')
                ).distinct()
        if request.query_params.get('programme'):
            students = students.filter(
                Q(programme_id=request.query_params['programme']) |
                Q(enrollments__section__programme_id=request.query_params['programme'],
                  enrollments__status='active')
            ).distinct()
        if request.query_params.get('active_only'):
            students = students.filter(is_active=True)
        if request.query_params.get('semester'):
            students = students.filter(
                enrollments__section__semester_id=request.query_params['semester'],
                enrollments__status='active'
            ).distinct()
        if request.query_params.get('section'):
            students = students.filter(
                enrollments__section_id=request.query_params['section'],
                enrollments__status='active'
            ).distinct()
        if request.query_params.get('search'):
            q = request.query_params['search']
            students = students.filter(
                Q(first_name__icontains=q) | Q(last_name__icontains=q) |
                Q(student_id__icontains=q) | Q(email__icontains=q)
            )
        return Response(StudentSerializer(students, many=True).data)

    def post(self, request):
        if not is_elevated(request.user):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        required = ['first_name', 'last_name', 'student_id', 'email']
        for f in required:
            if not request.data.get(f):
                return Response({'error': f'{f} is required'},
                                status=status.HTTP_400_BAD_REQUEST)
        if Student.objects.filter(student_id=request.data['student_id']).exists():
            return Response({'error': 'Student ID already exists'},
                            status=status.HTTP_400_BAD_REQUEST)
        programme = None
        if request.data.get('programme_id'):
            try:
                programme = Programme.objects.get(id=request.data['programme_id'])
            except Programme.DoesNotExist:
                return Response({'error': 'Programme not found'},
                                status=status.HTTP_404_NOT_FOUND)
        student = Student.objects.create(
            first_name=request.data['first_name'],
            last_name=request.data['last_name'],
            student_id=request.data['student_id'],
            email=request.data['email'],
            parent_email=request.data.get('parent_email', ''),
            parent_telegram=request.data.get('parent_telegram', ''),
            programme=programme,
        )
        if request.data.get('section_id'):
            try:
                section = Section.objects.get(id=request.data['section_id'])
                Enrollment.objects.create(student=student, section=section)
            except Section.DoesNotExist:
                pass
        return Response(StudentSerializer(student).data, status=status.HTTP_201_CREATED)


class StudentDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, student_id):
        try:
            student = Student.objects.get(id=student_id)
        except Student.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        for field in ['first_name', 'last_name', 'email',
                      'parent_email', 'parent_telegram', 'is_active']:
            if field in request.data:
                setattr(student, field, request.data[field])
        # Allow editing student_id (must remain unique)
        if 'student_id' in request.data:
            new_id = request.data['student_id'].strip()
            if new_id and Student.objects.exclude(pk=student.pk).filter(student_id=new_id).exists():
                return Response({'error': 'A student with this ID already exists.'},
                                status=status.HTTP_400_BAD_REQUEST)
            student.student_id = new_id
        # Allow moving student to a different programme
        if 'programme_id' in request.data:
            pid = request.data['programme_id']
            if pid:
                try:
                    student.programme = Programme.objects.get(id=pid)
                except Programme.DoesNotExist:
                    return Response({'error': 'Programme not found'},
                                    status=status.HTTP_404_NOT_FOUND)
            else:
                student.programme = None
        student.save()
        return Response(StudentSerializer(student).data)

    def delete(self, request, student_id):
        if not is_admin(request.user):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        try:
            student = Student.objects.get(id=student_id)
            student.is_active = False
            student.save()
            return Response({'message': 'Student deactivated'})
        except Student.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)


class StudentBulkImportView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not is_elevated(request.user):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        file = request.FILES.get('file')
        if not file:
            return Response({'error': 'CSV file is required'},
                            status=status.HTTP_400_BAD_REQUEST)
        decoded = file.read().decode('utf-8-sig')
        reader = csv.DictReader(io.StringIO(decoded))
        created, updated, errors = [], [], []
        for i, row in enumerate(reader, start=2):
            try:
                student_id = row.get('student_id', '').strip()
                if not student_id:
                    errors.append({'row': i, 'error': 'student_id is required'})
                    continue
                programme = None
                if row.get('programme_code', '').strip():
                    programme = Programme.objects.filter(
                        code__iexact=row['programme_code'].strip()).first()
                student, was_created = Student.objects.update_or_create(
                    student_id=student_id,
                    defaults={
                        'first_name':      row.get('first_name', '').strip(),
                        'last_name':       row.get('last_name', '').strip(),
                        'email':           row.get('email', '').strip(),
                        'parent_email':    row.get('parent_email', '').strip(),
                        'parent_telegram': row.get('parent_telegram', '').strip(),
                        'programme':       programme,
                        'is_active':       True,
                    }
                )
                if row.get('section_id', '').strip():
                    try:
                        section = Section.objects.get(
                            id=int(row['section_id'].strip()))
                        Enrollment.objects.get_or_create(
                            student=student, section=section,
                            defaults={'status': 'active'})
                    except (Section.DoesNotExist, ValueError):
                        pass
                if was_created:
                    created.append(student_id)
                else:
                    updated.append(student_id)
            except Exception as e:
                errors.append({'row': i, 'error': str(e)})
        return Response({
            'created': len(created), 'updated': len(updated), 'errors': errors,
            'message': (f'{len(created)} students created, {len(updated)} updated, '
                        f'{len(errors)} errors')
        }, status=status.HTTP_200_OK)


# ─────────────────────────────────────────
# ENROLLMENTS
# ─────────────────────────────────────────
class EnrollmentListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        enrollments = Enrollment.objects.select_related(
            'student', 'section__programme', 'section__semester__academic_year').all()
        enrollments = apply_programme_scope(
            enrollments, request.user, 'section__programme_id')
        if request.query_params.get('section'):
            enrollments = enrollments.filter(
                section_id=request.query_params['section'])
        if request.query_params.get('student'):
            enrollments = enrollments.filter(
                student_id=request.query_params['student'])
        if request.query_params.get('semester'):
            enrollments = enrollments.filter(
                section__semester_id=request.query_params['semester'])
        if request.query_params.get('status'):
            enrollments = enrollments.filter(status=request.query_params['status'])
        return Response(EnrollmentSerializer(enrollments, many=True).data)

    def post(self, request):
        if not is_admin(request.user):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        try:
            student = Student.objects.get(id=request.data['student_id'])
            section = Section.objects.get(id=request.data['section_id'])
        except (Student.DoesNotExist, Section.DoesNotExist, KeyError) as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        enrollment, created = Enrollment.objects.get_or_create(
            student=student, section=section, defaults={'status': 'active'})
        return Response(EnrollmentSerializer(enrollment).data,
                        status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class EnrollmentDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, enrollment_id):
        if not is_admin(request.user):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        try:
            enrollment = Enrollment.objects.get(id=enrollment_id)
        except Enrollment.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        if 'status' in request.data:
            enrollment.status = request.data['status']
            enrollment.save()
        return Response(EnrollmentSerializer(enrollment).data)

    def delete(self, request, enrollment_id):
        if not is_admin(request.user):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        try:
            enrollment = Enrollment.objects.get(id=enrollment_id)
            enrollment.delete()
            return Response({'message': 'Enrollment removed'})
        except Enrollment.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)


class BulkEnrollView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not is_admin(request.user):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        section_id  = request.data.get('section_id')
        student_ids = request.data.get('student_ids', [])
        if not section_id or not student_ids:
            return Response(
                {'error': 'section_id and student_ids are required'},
                status=status.HTTP_400_BAD_REQUEST)
        try:
            section = Section.objects.get(id=section_id)
        except Section.DoesNotExist:
            return Response({'error': 'Section not found'},
                            status=status.HTTP_404_NOT_FOUND)
        enrolled = skipped = 0
        for sid in student_ids:
            try:
                student = Student.objects.get(id=sid)
                _, created = Enrollment.objects.get_or_create(
                    student=student, section=section,
                    defaults={'status': 'active'})
                enrolled += 1 if created else 0
                skipped  += 0 if created else 1
            except Student.DoesNotExist:
                skipped += 1
        return Response({'enrolled': enrolled, 'skipped': skipped})


# ─────────────────────────────────────────
# COURSE OFFERINGS
# ─────────────────────────────────────────
class CourseOfferingListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        offerings = CourseOffering.objects.select_related(
            'course__programme', 'course__department',
            'section__programme', 'section__semester__academic_year', 'teacher'
        ).all()

        if user.role == 'teacher':
            offerings = offerings.filter(teacher=user)
        else:
            offerings = apply_programme_scope(
                offerings, user, 'section__programme_id')

        if request.query_params.get('semester'):
            offerings = offerings.filter(
                section__semester_id=request.query_params['semester'])
        if request.query_params.get('section'):
            offerings = offerings.filter(
                section_id=request.query_params['section'])
        if request.query_params.get('programme'):
            offerings = offerings.filter(
                section__programme_id=request.query_params['programme'])
        if request.query_params.get('teacher'):
            offerings = offerings.filter(
                teacher_id=request.query_params['teacher'])
        return Response(CourseOfferingSerializer(offerings, many=True).data)

    def post(self, request):
        if not is_admin(request.user):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        required = ['course_id', 'section_id']
        for f in required:
            if not request.data.get(f):
                return Response({'error': f'{f} is required'},
                                status=status.HTTP_400_BAD_REQUEST)
        try:
            course  = Course.objects.get(id=request.data['course_id'])
            section = Section.objects.get(id=request.data['section_id'])
        except (Course.DoesNotExist, Section.DoesNotExist) as e:
            return Response({'error': str(e)}, status=status.HTTP_404_NOT_FOUND)
        teacher = None
        if request.data.get('teacher_id'):
            try:
                teacher = User.objects.get(id=request.data['teacher_id'])
            except User.DoesNotExist:
                return Response({'error': 'Teacher not found'},
                                status=status.HTTP_404_NOT_FOUND)
        session_type = request.data.get('session_type', 'theory')
        offering, created = CourseOffering.objects.get_or_create(
            course=course, section=section, session_type=session_type,
            defaults={'teacher': teacher}
        )
        if not created and teacher:
            offering.teacher = teacher
            offering.save()
        return Response(CourseOfferingSerializer(offering).data,
                        status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class CourseOfferingDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, offering_id):
        if not is_admin(request.user):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        try:
            offering = CourseOffering.objects.get(id=offering_id)
        except CourseOffering.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        if 'teacher_id' in request.data:
            tid = request.data['teacher_id']
            if tid:
                try:
                    offering.teacher = User.objects.get(id=tid)
                except User.DoesNotExist:
                    return Response({'error': 'Teacher not found'},
                                    status=status.HTTP_404_NOT_FOUND)
            else:
                offering.teacher = None
        if 'session_type' in request.data:
            offering.session_type = request.data['session_type']
        offering.save()
        return Response(CourseOfferingSerializer(offering).data)

    def delete(self, request, offering_id):
        if not is_admin(request.user):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        try:
            offering = CourseOffering.objects.get(id=offering_id)
            offering.delete()
            return Response({'message': 'Course offering removed'})
        except CourseOffering.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)


class CourseOfferingStudentsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, offering_id):
        try:
            offering = CourseOffering.objects.get(id=offering_id)
        except CourseOffering.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        enrollments = Enrollment.objects.filter(
            section=offering.section, status='active').select_related('student')
        students = [e.student for e in enrollments]
        return Response({
            'offering':  CourseOfferingSerializer(offering).data,
            'students':  StudentSerializer(students, many=True).data
        })


class CourseOfferingSummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, offering_id):
        try:
            offering = CourseOffering.objects.get(id=offering_id)
        except CourseOffering.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        settings = SystemSettings.get()
        report_type = request.query_params.get('type', 'full')
        student_id = request.query_params.get('student')
        start_date = parse_report_date(request.query_params.get('start_date'))
        end_date = parse_report_date(request.query_params.get('end_date'))
        if report_type == 'weekly' and not start_date and not end_date:
            end_date = date.today()
            start_date = end_date - timedelta(days=7)

        rows = get_offering_student_report_data(
            offering,
            start_date=start_date,
            end_date=end_date,
            student_id=int(student_id) if student_id else None,
            warning_threshold=float(settings.warning_threshold),
            at_risk_threshold=float(settings.at_risk_threshold),
        )
        student_ids = [row['student_pk'] for row in rows]
        student_map = {
            s.id: StudentSerializer(s).data
            for s in Student.objects.filter(id__in=student_ids)
        }
        summary = []
        for row in rows:
            status_slug = (
                'safe' if row['status'] == 'Safe'
                else 'warning' if row['status'] == 'Warning'
                else 'at_risk'
            )
            summary.append({
                'student': student_map.get(row['student_pk'], {}),
                'attended_hours': row['attended_hours'],
                'missed_hours': row['missed_hours'],
                'total_hours': row['total_hours'],
                'attendance_percentage': row['percentage'],
                'minimum_required_hours': row['minimum_required'],
                'status': status_slug,
            })
        aggregates = build_offering_report_aggregates(rows)
        return Response({
            'offering': CourseOfferingSerializer(offering).data,
            'summary':  summary,
            'rows': rows,
            'aggregates': aggregates,
            'filters': {
                'type': report_type,
                'student': int(student_id) if student_id else None,
                'start_date': str(start_date) if start_date else None,
                'end_date': str(end_date) if end_date else None,
            },
        })


# ─────────────────────────────────────────
# ATTENDANCE
# ─────────────────────────────────────────
class AttendanceListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        records = AttendanceRecord.objects.select_related(
            'student', 'course_offering__course',
            'course_offering__section').order_by('-date')
        records = apply_programme_scope(
            records, request.user, 'course_offering__section__programme_id')
        if request.query_params.get('offering'):
            records = records.filter(
                course_offering_id=request.query_params['offering'])
        if request.query_params.get('section'):
            records = records.filter(
                course_offering__section_id=request.query_params['section'])
        if request.query_params.get('semester'):
            records = records.filter(
                course_offering__section__semester_id=request.query_params['semester'])
        if request.query_params.get('programme'):
            records = records.filter(
                course_offering__section__programme_id=request.query_params['programme'])
        if request.query_params.get('student'):
            records = records.filter(student_id=request.query_params['student'])
        if request.query_params.get('student_staff_id'):
            records = records.filter(
                student__student_id=request.query_params['student_staff_id'])
        if request.query_params.get('date'):
            try:
                records = records.filter(
                    date=datetime.date.fromisoformat(request.query_params['date']))
            except ValueError:
                pass
        if request.query_params.get('search'):
            q = request.query_params['search']
            records = records.filter(
                Q(student__first_name__icontains=q) |
                Q(student__last_name__icontains=q) |
                Q(student__student_id__icontains=q)
            )
        data = [{
            'id':           r.id,
            'date':         r.date,
            'student_name': r.student.full_name,
            'student_id':   r.student.student_id,
            'course_name':  r.course_offering.course.name,
            'section_name': r.course_offering.section.name,
            'status':       r.status,
            'hours_attended': r.hours_attended,
        } for r in records]
        return Response(data)


class AttendanceSubmitView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = AttendanceSubmitSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        data = serializer.validated_data
        try:
            offering = CourseOffering.objects.get(id=data['course_offering_id'])
        except CourseOffering.DoesNotExist:
            return Response({'error': 'Course offering not found'},
                            status=status.HTTP_404_NOT_FOUND)

        teacher      = request.user
        teacher_name = (f"{teacher.first_name} {teacher.last_name}".strip()
                        or teacher.username)
        absent_students = []
        count = 0

        for record in data['records']:
            student_id = record.get('student_id')
            status_val = record.get('status')
            try:
                student = Student.objects.get(id=student_id)
            except Student.DoesNotExist:
                continue
            comment_val = record.get('comment', '').strip()
            defaults = {
                'status':         status_val,
                'hours_attended': data['session_hours'],
                'recorded_by':    teacher,
                'comment':        comment_val,
            }
            try:
                AttendanceRecord.objects.update_or_create(
                    student=student, course_offering=offering,
                    date=data['date'], session_type=data['session_type'],
                    defaults=defaults,
                )
            except Exception as e:
                return Response(
                    {'error': f'Failed to save attendance record: {e}'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )
            count += 1
            if status_val == 'absent':
                absent_students.append(student.full_name)
                self._handle_absence(student, offering, data['date'], teacher)
            elif status_val == 'excused':
                self._handle_excused(student, offering, data['date'], teacher, comment_val)

        section_label = f"Sec {offering.section.name} Y{offering.section.year}"
        absent_count  = len(absent_students)
        teacher_msg   = (
            f"You logged attendance for {offering.course.name} ({section_label}) "
            f"on {data['date']}. {count} students recorded"
            + (f", {absent_count} absent." if absent_count else ".")
        )
        Notification.objects.create(
            recipient=teacher, notification_type='info', message=teacher_msg)
        admin_msg = (
            f"{teacher_name} logged attendance for {offering.course.name} "
            f"({section_label}) on {data['date']}. {count} students recorded"
            + (f", {absent_count} absent: {', '.join(absent_students[:5])}"
               + (" and more." if absent_count > 5 else ".")
               if absent_count else ".")
        )
        notify_elevated('info', admin_msg, programme=offering.course.programme)
        return Response({
            'message': f'Attendance recorded for {count} students',
            'date':    str(data['date']),
            'course':  offering.course.name,
        }, status=status.HTTP_201_CREATED)

    def _handle_absence(self, student, offering, att_date, teacher):
        teacher_name = (f"{teacher.first_name} {teacher.last_name}".strip()
                        or teacher.username)
        Notification.objects.create(
            recipient=teacher, notification_type='absence',
            message=(f"{student.full_name} was absent in "
                     f"{offering.course.name} on {att_date}."))
        notify_elevated(
            'absence',
            f"{student.full_name} (ID: {student.student_id}) was absent in "
            f"{offering.course.name} on {att_date}. Logged by {teacher_name}.",
            programme=offering.course.programme,
        )
        try:
            send_absence_alert(student, offering.course, att_date)
        except Exception:
            pass
        self._check_threshold(student, offering, teacher)

    def _handle_excused(self, student, offering, att_date, teacher, comment):
        teacher_name = (f"{teacher.first_name} {teacher.last_name}".strip() or teacher.username)
        reason_text  = f" Reason: {comment}" if comment else " No reason provided."
        Notification.objects.create(
            recipient=teacher, notification_type='info',
            message=(f"{student.full_name} was marked excused in "
                     f"{offering.course.name} on {att_date}.{reason_text}"))
        notify_elevated(
            'info',
            f"{student.full_name} (ID: {student.student_id}) was marked excused in "
            f"{offering.course.name} on {att_date}. Logged by {teacher_name}.{reason_text}",
            programme=offering.course.programme,
        )

    def _check_threshold(self, student, offering, teacher):
        settings_obj   = SystemSettings.get()
        at_risk_thr    = float(settings_obj.at_risk_threshold)
        warning_thr    = float(settings_obj.warning_threshold)
        teacher_name   = (f"{teacher.first_name} {teacher.last_name}".strip()
                          or teacher.username)
        records   = AttendanceRecord.objects.filter(
            student=student, course_offering=offering)
        present_h = records.filter(status='present').aggregate(total=Sum('hours_attended'))['total'] or Decimal('0')
        late_h    = records.filter(status='late').aggregate(total=Sum('hours_attended'))['total'] or Decimal('0')
        absent_h  = records.filter(status='absent').aggregate(total=Sum('hours_attended'))['total'] or Decimal('0')
        excused_h = records.filter(status='excused').aggregate(total=Sum('hours_attended'))['total'] or Decimal('0')
        total_logged = present_h + late_h + absent_h  # excused excluded
        if total_logged == 0:
            return
        total_credit    = Decimal(str(offering.course.total_credit_hours))
        effective_credit = max(total_credit - excused_h, Decimal('1'))
        if not is_gate_open(total_logged, total_credit):
            return
        late_count_thresh = records.filter(status='late').count()
        earned, pct = calc_attendance(present_h, late_h, effective_credit, late_count_thresh)
        minimum = offering.course.minimum_required_hours
        if pct < at_risk_thr:
            level, notif_type = "AT RISK", 'threshold'
        elif pct < warning_thr:
            level, notif_type = "WARNING", 'threshold'
        else:
            return
        message = (
            f"{level}: {student.full_name} (ID: {student.student_id}) attendance in "
            f"{offering.course.name} is now {pct}% "
            f"({float(earned):.1f} hrs attended). Minimum required: {float(minimum):.0f} hrs."
        )
        Notification.objects.create(
            recipient=teacher, notification_type=notif_type, message=message)
        notify_elevated(
            notif_type, f"{message} Logged by {teacher_name}.",
            programme=offering.course.programme)
        try:
            send_threshold_warning(student, offering.course, earned, minimum)
        except Exception:
            pass


# ─────────────────────────────────────────
# AT-RISK
# ─────────────────────────────────────────
class AtRiskView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        settings      = SystemSettings.get()
        at_risk_thr   = float(settings.at_risk_threshold)
        semester_id   = request.query_params.get('semester')
        programme_id  = request.query_params.get('programme')
        offerings = CourseOffering.objects.select_related(
            'course', 'section__semester', 'section__programme').all()
        offerings = apply_programme_scope(
            offerings, request.user, 'section__programme_id')
        if semester_id:
            offerings = offerings.filter(section__semester_id=semester_id)
        if programme_id:
            offerings = offerings.filter(section__programme_id=programme_id)
        at_risk = []
        for offering in offerings:
            enrollments = Enrollment.objects.filter(
                section=offering.section, status='active'
            ).select_related('student')
            for e in enrollments:
                student  = e.student
                records  = AttendanceRecord.objects.filter(
                    student=student, course_offering=offering)
                present_h = records.filter(status='present').aggregate(total=Sum('hours_attended'))['total'] or Decimal('0')
                late_h    = records.filter(status='late').aggregate(total=Sum('hours_attended'))['total'] or Decimal('0')
                absent_h  = records.filter(status='absent').aggregate(total=Sum('hours_attended'))['total'] or Decimal('0')
                excused_h = records.filter(status='excused').aggregate(total=Sum('hours_attended'))['total'] or Decimal('0')
                total_logged = present_h + late_h + absent_h  # excused excluded
                if total_logged == 0:
                    continue
                total_credit    = Decimal(str(offering.course.total_credit_hours))
                effective_credit = max(total_credit - excused_h, Decimal('1'))
                if not is_gate_open(total_logged, total_credit):
                    continue
                late_count_atrisk = records.filter(status='late').count()
                earned, pct = calc_attendance(present_h, late_h, effective_credit, late_count_atrisk)
                if pct < at_risk_thr:
                    at_risk.append({
                        'student_id':          student.student_id,
                        'student_name':        student.full_name,
                        'course_name':         offering.course.name,
                        'department_name':     (offering.course.department.name
                                                if offering.course.department else '—'),
                        'section':             offering.section.name,
                        'programme':           offering.section.programme.name,
                        'attended_hours':      float(present_h + late_h),
                        'missed_hours':        float(missed),
                        'attendance_percentage': pct,
                        'minimum_required':    float(offering.course.minimum_required_hours),
                    })
        return Response({'count': len(at_risk), 'students': at_risk})


# ─────────────────────────────────────────
# STATS
# ─────────────────────────────────────────
class StatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user        = request.user
        semester_id = request.query_params.get('semester')
        current_semester = None
        if semester_id:
            try:
                current_semester = Semester.objects.get(id=semester_id)
            except Semester.DoesNotExist:
                pass
        else:
            current_semester = Semester.objects.filter(is_current=True).first()

        prog_ids = get_programme_ids(user)

        def scope(qs, field):
            if prog_ids is None:
                return qs
            if not prog_ids:
                return qs.none()
            return qs.filter(**{f'{field}__in': prog_ids})

        total_students   = scope(Student.objects.filter(is_active=True),
                                 'programme_id').count()
        total_courses    = scope(Course.objects.filter(is_active=True),
                                 'programme_id').count()
        total_programmes = scope(Programme.objects.filter(is_active=True),
                                 'id').count()
        active_enrollments = 0
        status_counts = {'present': 0, 'late': 0, 'excused': 0, 'absent': 0}

        if current_semester:
            enroll_qs = scope(
                Enrollment.objects.filter(
                    section__semester=current_semester, status='active'),
                'section__programme_id')
            active_enrollments = enroll_qs.count()
            records = scope(
                AttendanceRecord.objects.filter(
                    course_offering__section__semester=current_semester),
                'course_offering__section__programme_id')
            for s in status_counts:
                status_counts[s] = records.filter(status=s).count()

        return Response({
            'total_students':    total_students,
            'total_courses':     total_courses,
            'total_programmes':  total_programmes,
            'active_enrollments': active_enrollments,
            'current_semester':  (SemesterSerializer(current_semester).data
                                   if current_semester else None),
            'status_distribution': status_counts,
        })


# ─────────────────────────────────────────
# USERS
# ─────────────────────────────────────────
class UserListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        users = User.objects.all()
        role_filter = request.query_params.get('role')
 
        if role_filter:
            users = users.filter(role=role_filter)
 
            # Scope teacher list for dean/dept_head:
            # only return teachers who have offerings in the user's programme(s)
            if role_filter == 'teacher':
                prog_ids = get_programme_ids(request.user)
                if prog_ids is not None and len(prog_ids) > 0:
                    teacher_ids = CourseOffering.objects.filter(
                        course__programme_id__in=prog_ids
                    ).values_list('teacher_id', flat=True).distinct()
                    users = users.filter(id__in=teacher_ids)
 
        return Response(UserSerializer(users, many=True).data)

    def post(self, request):
        if not is_admin(request.user):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        required = ['email', 'role', 'password']
        for f in required:
            if not request.data.get(f):
                return Response({'error': f'{f} is required'},
                                status=status.HTTP_400_BAD_REQUEST)
        username = (request.data.get('username') or
                    request.data.get('staff_id') or
                    request.data['email'])
        if User.objects.filter(username=username).exists():
            return Response({'error': 'Username already exists'},
                            status=status.HTTP_400_BAD_REQUEST)
        managed_programme  = None
        managed_department = None
        if request.data.get('managed_programme_id'):
            try:
                managed_programme = Programme.objects.get(
                    id=request.data['managed_programme_id'])
            except Programme.DoesNotExist:
                return Response({'error': 'Programme not found'},
                                status=status.HTTP_404_NOT_FOUND)
        if request.data.get('managed_department_id'):
            try:
                managed_department = Department.objects.get(
                    id=request.data['managed_department_id'])
            except Department.DoesNotExist:
                return Response({'error': 'Department not found'},
                                status=status.HTTP_404_NOT_FOUND)
        user = User.objects.create(
            username=username,
            staff_id=request.data.get('staff_id', ''),
            first_name=request.data.get('first_name', ''),
            last_name=request.data.get('last_name', ''),
            email=request.data['email'],
            role=request.data['role'],
            password=make_password(request.data['password']),
            managed_programme=managed_programme,
            managed_department=managed_department,
        )
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


class UserDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, user_id):
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        for field in ['first_name', 'last_name', 'email', 'role', 'staff_id']:
            if field in request.data:
                setattr(user, field, request.data[field])
        if 'username' in request.data:
            new_username = request.data['username'].strip()
            if new_username and User.objects.exclude(pk=user.pk).filter(username=new_username).exists():
                return Response({'error': 'A user with this username already exists.'},
                                status=status.HTTP_400_BAD_REQUEST)
            user.username = new_username
        if request.data.get('password'):
            user.password = make_password(request.data['password'])
        if 'managed_programme_id' in request.data:
            pid = request.data['managed_programme_id']
            user.managed_programme = (Programme.objects.filter(id=pid).first()
                                      if pid else None)
        if 'managed_department_id' in request.data:
            did = request.data['managed_department_id']
            user.managed_department = (Department.objects.filter(id=did).first()
                                       if did else None)
        user.save()
        return Response(UserSerializer(user).data)

    def delete(self, request, user_id):
        if not is_admin(request.user):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        try:
            user = User.objects.get(id=user_id)
            if user.is_superuser:
                return Response({'error': 'Cannot delete superuser'},
                                status=status.HTTP_400_BAD_REQUEST)
            user.delete()
            return Response({'message': 'User deleted'})
        except User.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)


# ─────────────────────────────────────────
# NOTIFICATIONS
# ─────────────────────────────────────────
class NotificationListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user         = request.user
        prog_ids     = get_programme_ids(user)
        if prog_ids is None:
            notifications = Notification.objects.filter(
                Q(recipient=user) | Q(recipient__isnull=True), is_read=False
            ).order_by('-created_at')
        else:
            notifications = Notification.objects.filter(
                Q(recipient=user) | Q(programme_id__in=prog_ids), is_read=False
            ).order_by('-created_at')
        return Response({
            'count':         notifications.count(),
            'notifications': NotificationSerializer(notifications, many=True).data
        })


class NotificationMarkReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, notification_id):
        user     = request.user
        prog_ids = get_programme_ids(user)
        try:
            if prog_ids is None:
                n = Notification.objects.get(
                    Q(recipient=user) | Q(recipient__isnull=True),
                    id=notification_id)
            else:
                n = Notification.objects.get(
                    Q(recipient=user) | Q(programme_id__in=prog_ids),
                    id=notification_id)
            n.is_read = True
            n.save()
            return Response({'message': 'Marked as read'})
        except Notification.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)


# ─────────────────────────────────────────
# SETTINGS
# ─────────────────────────────────────────
class SystemSettingsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(SystemSettingsSerializer(SystemSettings.get()).data)

    def patch(self, request):
        if not is_admin(request.user):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        s = SystemSettings.get()
        serializer = SystemSettingsSerializer(s, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ─────────────────────────────────────────
# REPORTS
# ─────────────────────────────────────────
class CourseOfferingReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, offering_id):
        try:
            offering = CourseOffering.objects.get(id=offering_id)
        except CourseOffering.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        report_format = request.query_params.get('rpt_format', 'pdf')
        report_type   = request.query_params.get('type', 'full')
        student_id = request.query_params.get('student')
        student = Student.objects.filter(id=student_id).first() if student_id else None
        start_date = parse_report_date(request.query_params.get('start_date'))
        end_date = parse_report_date(request.query_params.get('end_date'))
        try:
            if report_type == 'weekly' and not start_date and not end_date:
                end_date = date.today()
                start_date = end_date - timedelta(days=7)

            settings = SystemSettings.get()
            summary = get_offering_student_report_data(
                offering,
                start_date=start_date,
                end_date=end_date,
                student_id=int(student_id) if student_id else None,
                warning_threshold=float(settings.warning_threshold),
                at_risk_threshold=float(settings.at_risk_threshold),
            )
            aggregates = build_offering_report_aggregates(summary)
            if report_type == 'weekly':
                title = "Weekly Attendance Report"
                filename = f"{offering.course.name}_weekly_{end_date or date.today()}"
            elif report_type == 'custom':
                title = "Filtered Attendance Report"
                filename = f"{offering.course.name}_filtered_report"
            else:
                title = "Full Attendance Report"
                filename = f"{offering.course.name}_full_report"
            if student:
                filename = f"{filename}_{student.student_id}"

            if report_format == 'csv':
                return generate_offering_filtered_csv(
                    offering,
                    summary,
                    aggregates,
                    f"{filename}.csv",
                    {
                        'report_type': report_type,
                        'start_date': str(start_date) if start_date else None,
                        'end_date': str(end_date) if end_date else None,
                        'student_label': f"{student.full_name} ({student.student_id})" if student else None,
                    },
                )
            filter_meta_pdf = {
                'report_type': report_type,
                'start_date': str(start_date) if start_date else None,
                'end_date': str(end_date) if end_date else None,
                'student_label': f"{student.full_name} ({student.student_id})" if student else None,
            }
            buffer = generate_course_pdf(offering.course, summary, title,
                                         filter_meta=filter_meta_pdf, offering=offering)
            response = HttpResponse(buffer, content_type='application/pdf')
            response['Content-Disposition'] = (
                f'attachment; filename="{filename}.pdf"')
            return response
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({'error': f'Report generation failed: {str(e)}'},
                            status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class StudentReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, student_id):
        try:
            student = Student.objects.get(id=student_id)
        except Student.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        report_format = request.query_params.get('rpt_format', 'pdf')
        semester_id   = request.query_params.get('semester')
        offering_id = request.query_params.get('offering')
        report_type = request.query_params.get('type', 'full')
        start_date = parse_report_date(request.query_params.get('start_date'))
        end_date = parse_report_date(request.query_params.get('end_date'))
        if report_type == 'weekly' and not start_date and not end_date:
            end_date = date.today()
            start_date = end_date - timedelta(days=7)
        try:
            records_qs = AttendanceRecord.objects.filter(student=student)
            if semester_id:
                records_qs = records_qs.filter(
                    course_offering__section__semester_id=semester_id)
            if offering_id:
                records_qs = records_qs.filter(course_offering_id=offering_id)
            if start_date:
                records_qs = records_qs.filter(date__gte=start_date)
            if end_date:
                records_qs = records_qs.filter(date__lte=end_date)
            offering_ids   = records_qs.values_list(
                'course_offering_id', flat=True).distinct()
            course_summaries = []
            for oid in offering_ids:
                offering = CourseOffering.objects.get(id=oid)
                attended = records_qs.filter(
                    course_offering=offering,
                    status__in=['present', 'late']
                ).aggregate(total=Sum('hours_attended'))['total'] or Decimal('0')
                missed   = records_qs.filter(
                    course_offering=offering,
                    status__in=['absent', 'excused']
                ).aggregate(total=Sum('hours_attended'))['total'] or Decimal('0')
                total    = offering.course.total_credit_hours
                pct      = round(
                    float(attended) / float(total) * 100 if total > 0 else 0, 1)
                course_summaries.append({
                    'course_name':      offering.course.name,
                    'attended_hours':   float(attended),
                    'missed_hours':     float(missed),
                    'total_hours':      float(total),
                    'percentage':       pct,
                    'minimum_required': float(offering.course.minimum_required_hours),
                    'status': ('Safe' if pct >= 90 else
                               'Warning' if pct >= 85 else 'At Risk'),
                })
            if report_format == 'csv':
                filter_meta_stu = {
                    'report_type': report_type,
                    'start_date': str(start_date) if start_date else None,
                    'end_date': str(end_date) if end_date else None,
                }
                return generate_student_csv(student, course_summaries, filter_meta=filter_meta_stu)
            filter_meta_stu = {
                'report_type': report_type,
                'start_date': str(start_date) if start_date else None,
                'end_date': str(end_date) if end_date else None,
            }
            buffer = generate_student_pdf(student, course_summaries, filter_meta=filter_meta_stu)
            response = HttpResponse(buffer, content_type='application/pdf')
            response['Content-Disposition'] = (
                f'attachment; filename="student_{student.student_id}_report.pdf"')
            return response
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({'error': f'Report generation failed: {str(e)}'},
                            status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class SummaryReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        report_format = request.query_params.get('rpt_format')
        payload = build_summary_payload(request.user, request.query_params)
        if report_format == 'csv':
            return generate_summary_overview_csv(payload, "attendance_summary_overview.csv")
        if report_format == 'pdf':
            buffer = generate_summary_overview_pdf(payload)
            response = HttpResponse(buffer, content_type='application/pdf')
            response['Content-Disposition'] = 'attachment; filename="attendance_summary_overview.pdf"'
            return response
        return Response(payload)