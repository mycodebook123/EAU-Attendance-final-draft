from decimal import Decimal
from django.db import models
from django.contrib.auth.models import AbstractUser
from django.core.validators import MinValueValidator
from django.db.models.signals import post_save
from django.dispatch import receiver


# ─────────────────────────────────────────
# USER
# ─────────────────────────────────────────
class User(AbstractUser):
    ROLE_CHOICES = (
        ('teacher',   'Teacher'),
        ('dept_head', 'Department Head'),
        ('dean',      'Dean'),
        ('admin',     'Admin'),
        ('student',   'Student'),
    )
    staff_id = models.CharField(max_length=30, unique=True, blank=True, null=True)
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='teacher')

    # Dean manages a whole Programme (= School/Faculty in EAU terms)
    managed_programme = models.ForeignKey(
        'Programme', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='deans'
    )
    # Dept Head manages one Department within a Programme
    managed_department = models.ForeignKey(
        'Department', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='department_heads'
    )

    def __str__(self):
        return f"{self.get_full_name()} ({self.role})"

    def is_admin_or_super(self):
        return self.role == 'admin' or self.is_superuser

    def is_elevated(self):
        return self.role in ('admin', 'dean', 'dept_head') or self.is_superuser


# ─────────────────────────────────────────
# ACADEMIC STRUCTURE
# ─────────────────────────────────────────
class Programme(models.Model):
    """
    In EAU terms this is a School/Faculty.
    e.g. 'School of Aircraft Maintenance Engineering'
    A Dean manages one Programme.
    """
    name = models.CharField(max_length=150)
    code = models.CharField(max_length=20, blank=True, default='')
    duration_years = models.IntegerField(default=4)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name


class Department(models.Model):
    """
    A Department lives inside a Programme (School/Faculty).
    e.g. 'Engineering Drawing Dept' inside 'Aircraft Maintenance Engineering'
    A Department Head manages one Department.
    """
    name = models.CharField(max_length=200)
    code = models.CharField(max_length=20, blank=True, default='')
    programme = models.ForeignKey(
        Programme, on_delete=models.CASCADE, related_name='departments'
    )
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.name} ({self.programme.name})"


class Course(models.Model):
    """
    A Course belongs to a Programme (required).
    Optionally also linked to a Department within that Programme.
    Courses without a department are still fully functional.
    """
    name = models.CharField(max_length=150)
    code = models.CharField(max_length=20, blank=True, default='')
    programme = models.ForeignKey(
        Programme, on_delete=models.CASCADE, related_name='courses'
    )
    # Optional — course can belong to a specific department
    department = models.ForeignKey(
        Department, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='courses'
    )
    year = models.IntegerField(default=1)
    total_credit_hours = models.DecimalField(
        max_digits=5, decimal_places=1, validators=[MinValueValidator(1)]
    )
    minimum_attendance_percent = models.DecimalField(
        max_digits=5, decimal_places=1, default=Decimal('85.0')
    )
    is_active = models.BooleanField(default=True)

    @property
    def minimum_required_hours(self):
        return (self.total_credit_hours * self.minimum_attendance_percent / 100).quantize(
            Decimal('0.1')
        )

    def __str__(self):
        return f"{self.name} ({self.programme.name})"


# ─────────────────────────────────────────
# ACADEMIC CALENDAR
# ─────────────────────────────────────────
class AcademicYear(models.Model):
    name = models.CharField(max_length=10, unique=True)
    start_date = models.DateField()
    end_date = models.DateField()
    is_current = models.BooleanField(default=False)

    def save(self, *args, **kwargs):
        if self.is_current:
            AcademicYear.objects.exclude(pk=self.pk).update(is_current=False)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class Semester(models.Model):
    SEMESTER_CHOICES = ((1, 'Semester 1'), (2, 'Semester 2'))
    academic_year = models.ForeignKey(
        AcademicYear, on_delete=models.CASCADE, related_name='semesters'
    )
    number = models.IntegerField(choices=SEMESTER_CHOICES)
    start_date = models.DateField()
    end_date = models.DateField()
    is_current = models.BooleanField(default=False)

    def save(self, *args, **kwargs):
        if self.is_current:
            Semester.objects.exclude(pk=self.pk).update(is_current=False)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.academic_year.name} - Sem {self.number}"


# ─────────────────────────────────────────
# SECTIONS & STUDENTS
# ─────────────────────────────────────────
class Section(models.Model):
    name = models.CharField(max_length=10)
    programme = models.ForeignKey(
        Programme, on_delete=models.CASCADE, related_name='sections'
    )
    year = models.IntegerField()
    semester = models.ForeignKey(
        Semester, on_delete=models.CASCADE, related_name='sections'
    )

    def __str__(self):
        return f"{self.name} ({self.programme.name})"


class Student(models.Model):
    first_name = models.CharField(max_length=50)
    last_name = models.CharField(max_length=50)
    student_id = models.CharField(max_length=20, unique=True)
    email = models.EmailField(unique=True)
    parent_email = models.EmailField(blank=True, default='')
    parent_telegram = models.CharField(max_length=100, blank=True, default='')
    programme = models.ForeignKey(
        Programme, on_delete=models.SET_NULL, null=True, related_name='students'
    )
    is_active = models.BooleanField(default=True)

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"

    def __str__(self):
        return self.full_name


class Enrollment(models.Model):
    STATUS_CHOICES = (
        ('active', 'Active'),
        ('graduated', 'Graduated'),
        ('withdrawn', 'Withdrawn'),
        ('transferred', 'Transferred'),
        ('suspended', 'Suspended'),
    )
    student = models.ForeignKey(
        Student, on_delete=models.CASCADE, related_name='enrollments'
    )
    section = models.ForeignKey(
        Section, on_delete=models.CASCADE, related_name='enrollments'
    )
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='active')
    enrolled_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('student', 'section')

    def __str__(self):
        return f"{self.student} → {self.section} ({self.status})"


# ─────────────────────────────────────────
# ATTENDANCE
# ─────────────────────────────────────────
class CourseOffering(models.Model):
    SESSION_TYPE_CHOICES = (
        ('theory',    'Theory'),
        ('practical', 'Practical'),
    )
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='offerings')
    section = models.ForeignKey(Section, on_delete=models.CASCADE, related_name='offerings')
    teacher = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name='offerings'
    )
    session_type = models.CharField(
        max_length=15, choices=SESSION_TYPE_CHOICES, default='theory'
    )

    class Meta:
        unique_together = ('course', 'section', 'session_type')

    def __str__(self):
        return f"{self.course.name} – {self.section} ({self.teacher})"


class AttendanceRecord(models.Model):
    STATUS_CHOICES = (
        ('present', 'Present'),
        ('late',    'Late'),
        ('excused', 'Excused'),
        ('absent',  'Absent'),
    )
    SESSION_TYPE_CHOICES = (
        ('theory',    'Theory'),
        ('practical', 'Practical'),
    )
    student = models.ForeignKey(
        Student, on_delete=models.CASCADE, related_name='attendance_records'
    )
    course_offering = models.ForeignKey(
        CourseOffering, on_delete=models.CASCADE, related_name='attendance_records'
    )
    date = models.DateField()
    status = models.CharField(max_length=10, choices=STATUS_CHOICES)
    session_type = models.CharField(
        max_length=15, choices=SESSION_TYPE_CHOICES, default='theory'
    )
    hours_attended = models.DecimalField(
        max_digits=4, decimal_places=1, default=Decimal('1.0')
    )
    recorded_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True,
        related_name='recorded_attendance'
    )
    comment = models.CharField(
        max_length=300, blank=True, default='',
        help_text='Optional reason shown for excused absences.'
    )

    class Meta:
        unique_together = ('student', 'course_offering', 'date', 'session_type')

    def __str__(self):
        return f"{self.student} – {self.course_offering.course.name} ({self.date}): {self.status}"


# ─────────────────────────────────────────
# NOTIFICATIONS
# ─────────────────────────────────────────
class Notification(models.Model):
    NOTIFICATION_TYPE_CHOICES = (
        ('absence',   'Absence Alert'),
        ('threshold', 'Threshold Warning'),
        ('info',      'Information'),
    )
    recipient = models.ForeignKey(
        User, on_delete=models.CASCADE, null=True, blank=True,
        related_name='notifications'
    )
    notification_type = models.CharField(
        max_length=20, choices=NOTIFICATION_TYPE_CHOICES, default='info'
    )
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    # Scope tag at programme level so dean/dept_head see relevant notifications
    programme = models.ForeignKey(
        Programme, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='notifications'
    )

    def __str__(self):
        return f"[{self.notification_type}] {self.message[:60]}"


class SystemSettings(models.Model):
    email_alerts_enabled = models.BooleanField(default=True)
    telegram_alerts_enabled = models.BooleanField(default=False)
    threshold_warnings_enabled = models.BooleanField(default=True)
    weekly_reports_enabled = models.BooleanField(default=False)
    at_risk_threshold = models.DecimalField(
        max_digits=5, decimal_places=1, default=Decimal('85.0')
    )
    warning_threshold = models.DecimalField(
        max_digits=5, decimal_places=1, default=Decimal('90.0')
    )

    @classmethod
    def get(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    def __str__(self):
        return "System Settings"


# ─────────────────────────────────────────
# SIGNALS
# ─────────────────────────────────────────
from .notifications import send_attendance_alert  # noqa: E402


@receiver(post_save, sender=AttendanceRecord)
def trigger_notifications(sender, instance, created, **kwargs):
    if instance.status == 'absent':
        send_attendance_alert(instance)