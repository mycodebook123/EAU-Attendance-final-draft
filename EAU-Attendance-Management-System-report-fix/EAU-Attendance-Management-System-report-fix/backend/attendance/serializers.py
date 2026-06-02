from rest_framework import serializers
from .models import (
    User, Programme, Department, Course, AcademicYear, Semester,
    Section, Student, Enrollment, CourseOffering,
    AttendanceRecord, Notification, SystemSettings
)


class DepartmentSerializer(serializers.ModelSerializer):
    programme_name = serializers.CharField(source='programme.name', read_only=True)
    course_count = serializers.SerializerMethodField()

    class Meta:
        model = Department
        fields = ['id', 'name', 'code', 'programme', 'programme_name',
                  'is_active', 'course_count']

    def get_course_count(self, obj):
        return obj.courses.filter(is_active=True).count()


class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    managed_programme_name = serializers.CharField(
        source='managed_programme.name', read_only=True
    )
    managed_department_name = serializers.CharField(
        source='managed_department.name', read_only=True
    )
    # For dept_head, expose which programme their department belongs to
    managed_department_programme = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'staff_id', 'email',
            'first_name', 'last_name', 'full_name', 'role',
            'managed_programme', 'managed_programme_name',
            'managed_department', 'managed_department_name',
            'managed_department_programme',
        ]

    def get_full_name(self, obj):
        return obj.get_full_name()

    def get_managed_department_programme(self, obj):
        """Returns the programme_id of the dept_head's department — used for scoping."""
        if obj.role == 'dept_head' and obj.managed_department:
            return obj.managed_department.programme_id
        return None


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)


class ProgrammeSerializer(serializers.ModelSerializer):
    student_count = serializers.SerializerMethodField()
    course_count = serializers.SerializerMethodField()
    department_count = serializers.SerializerMethodField()

    class Meta:
        model = Programme
        fields = [
            'id', 'name', 'code', 'duration_years', 'is_active',
            'student_count', 'course_count', 'department_count'
        ]

    def get_student_count(self, obj):
        return obj.students.filter(is_active=True).count()

    def get_course_count(self, obj):
        return obj.courses.filter(is_active=True).count()

    def get_department_count(self, obj):
        return obj.departments.filter(is_active=True).count()


class CourseSerializer(serializers.ModelSerializer):
    programme_name = serializers.CharField(source='programme.name', read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True)
    minimum_required_hours = serializers.ReadOnlyField()

    class Meta:
        model = Course
        fields = [
            'id', 'name', 'code', 'programme', 'programme_name',
            'department', 'department_name',
            'year', 'total_credit_hours', 'minimum_required_hours',
            'minimum_attendance_percent', 'is_active'
        ]


class AcademicYearSerializer(serializers.ModelSerializer):
    semester_count = serializers.SerializerMethodField()

    class Meta:
        model = AcademicYear
        fields = ['id', 'name', 'start_date', 'end_date', 'is_current', 'semester_count']

    def get_semester_count(self, obj):
        return obj.semesters.count()


class SemesterSerializer(serializers.ModelSerializer):
    academic_year_name = serializers.CharField(source='academic_year.name', read_only=True)
    label = serializers.SerializerMethodField()
    section_count = serializers.SerializerMethodField()

    class Meta:
        model = Semester
        fields = [
            'id', 'academic_year', 'academic_year_name',
            'number', 'start_date', 'end_date', 'is_current',
            'label', 'section_count'
        ]

    def get_label(self, obj):
        return f"{obj.academic_year.name} — Semester {obj.number}"

    def get_section_count(self, obj):
        return obj.sections.count()


class SectionSerializer(serializers.ModelSerializer):
    programme_name = serializers.CharField(source='programme.name', read_only=True)
    semester_label = serializers.SerializerMethodField()
    student_count = serializers.SerializerMethodField()

    class Meta:
        model = Section
        fields = [
            'id', 'name', 'programme', 'programme_name',
            'year', 'semester', 'semester_label', 'student_count'
        ]

    def get_semester_label(self, obj):
        return str(obj.semester)

    def get_student_count(self, obj):
        return obj.enrollments.filter(status='active').count()


class StudentSerializer(serializers.ModelSerializer):
    full_name = serializers.ReadOnlyField()
    programme_name = serializers.CharField(source='programme.name', read_only=True)
    current_section = serializers.SerializerMethodField()

    class Meta:
        model = Student
        fields = [
            'id', 'first_name', 'last_name', 'full_name',
            'student_id', 'email', 'parent_email', 'parent_telegram',
            'programme', 'programme_name', 'is_active', 'current_section'
        ]

    def get_current_section(self, obj):
        enrollment = obj.enrollments.filter(
            status='active'
        ).select_related(
            'section__programme', 'section__semester__academic_year'
        ).order_by(
            '-section__semester__academic_year__start_date',
            '-section__semester__number'
        ).first()
        if enrollment:
            return {
                'section_id':   enrollment.section.id,
                'section_name': enrollment.section.name,
                'year':         enrollment.section.year,
                'programme':    enrollment.section.programme.name,
                'semester':     str(enrollment.section.semester),
            }
        return None


class EnrollmentSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.full_name', read_only=True)
    student_id_number = serializers.CharField(source='student.student_id', read_only=True)
    section_name = serializers.CharField(source='section.name', read_only=True)
    section_year = serializers.IntegerField(source='section.year', read_only=True)
    semester_label = serializers.SerializerMethodField()

    class Meta:
        model = Enrollment
        fields = [
            'id', 'student', 'student_name', 'student_id_number',
            'section', 'section_name', 'section_year',
            'semester_label', 'status', 'enrolled_at'
        ]

    def get_semester_label(self, obj):
        return str(obj.section.semester)


class CourseOfferingSerializer(serializers.ModelSerializer):
    course_name = serializers.CharField(source='course.name', read_only=True)
    course_code = serializers.CharField(source='course.code', read_only=True)
    total_credit_hours = serializers.DecimalField(
        source='course.total_credit_hours', max_digits=5, decimal_places=1, read_only=True
    )
    minimum_required_hours = serializers.DecimalField(
        source='course.minimum_required_hours', max_digits=5, decimal_places=1, read_only=True
    )
    section_name = serializers.CharField(source='section.name', read_only=True)
    section_year = serializers.IntegerField(source='section.year', read_only=True)
    programme_name = serializers.CharField(source='section.programme.name', read_only=True)
    department_name = serializers.CharField(
        source='course.department.name', read_only=True
    )
    teacher_name = serializers.SerializerMethodField()
    semester_label = serializers.SerializerMethodField()

    class Meta:
        model = CourseOffering
        fields = [
            'id', 'course', 'course_name', 'course_code',
            'total_credit_hours', 'minimum_required_hours',
            'section', 'section_name', 'section_year',
            'programme_name', 'department_name',
            'teacher', 'teacher_name', 'semester_label'
        ]

    def get_teacher_name(self, obj):
        return obj.teacher.get_full_name() if obj.teacher else None

    def get_semester_label(self, obj):
        return str(obj.section.semester)


class AttendanceRecordSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.full_name', read_only=True)
    student_id_number = serializers.CharField(source='student.student_id', read_only=True)
    course_name = serializers.SerializerMethodField()
    section_name = serializers.SerializerMethodField()

    class Meta:
        model = AttendanceRecord
        fields = [
            'id', 'student', 'student_name', 'student_id_number',
            'course_offering', 'course_name', 'section_name',
            'date', 'status', 'session_type', 'hours_attended', 'recorded_by'
        ]
        read_only_fields = ['recorded_by']

    def get_course_name(self, obj):
        return obj.course_offering.course.name

    def get_section_name(self, obj):
        return obj.course_offering.section.name


class AttendanceSubmitSerializer(serializers.Serializer):
    course_offering_id = serializers.IntegerField()
    date = serializers.DateField()
    session_type = serializers.ChoiceField(choices=['theory', 'practical'])
    session_hours = serializers.DecimalField(max_digits=4, decimal_places=1)
    records = serializers.ListField(child=serializers.DictField())


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ['id', 'notification_type', 'message', 'is_read', 'created_at']


class SystemSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemSettings
        fields = [
            'email_alerts_enabled', 'telegram_alerts_enabled',
            'threshold_warnings_enabled', 'weekly_reports_enabled',
            'at_risk_threshold', 'warning_threshold',
        ]