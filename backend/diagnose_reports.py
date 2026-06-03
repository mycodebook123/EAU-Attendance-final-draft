"""
Run this from your backend directory:
  python manage.py shell < diagnose_reports.py

It will tell you exactly what is broken.
"""
import django, os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sams.settings')

print("=" * 60)
print("SAMS Report Diagnostic")
print("=" * 60)

# ── 1. Check models.py has minimum_required_hours ────────────
print("\n[1] Checking Course.minimum_required_hours property...")
try:
    from attendance.models import Course
    c = Course.objects.first()
    if c is None:
        print("    WARNING: No courses in DB — create one first")
    else:
        val = c.minimum_required_hours
        print(f"    OK — Course '{c.name}' minimum_required_hours = {val}")
except AttributeError as e:
    print(f"    FAIL — AttributeError: {e}")
    print("    FIX: Replace backend/attendance/models.py with the fixed version")
except Exception as e:
    print(f"    FAIL — {type(e).__name__}: {e}")

# ── 2. Check reports.py imports cleanly ──────────────────────
print("\n[2] Checking reports.py imports...")
try:
    from attendance.reports import (
        get_course_offering_summary,
        generate_course_pdf,
        generate_course_csv,
        generate_student_pdf,
        generate_student_csv,
    )
    print("    OK — all 5 functions imported successfully")
except ImportError as e:
    print(f"    FAIL — ImportError: {e}")
    print("    FIX: Replace backend/attendance/reports.py with the fixed version")
except Exception as e:
    print(f"    FAIL — {type(e).__name__}: {e}")

# ── 3. Check CourseOffering ID=1 exists ──────────────────────
print("\n[3] Checking CourseOffering with id=1 exists...")
try:
    from attendance.models import CourseOffering
    offering = CourseOffering.objects.first()
    if offering is None:
        print("    FAIL — No CourseOfferings in DB at all!")
        print("    FIX: Create a course offering in the Setup tab first")
    else:
        print(f"    OK — First offering: id={offering.id}, course='{offering.course.name}'")
        # Check if id=1 specifically exists
        try:
            o1 = CourseOffering.objects.get(id=1)
            print(f"    OK — id=1 exists: '{o1.course.name}'")
        except CourseOffering.DoesNotExist:
            print(f"    NOTE — id=1 does not exist. First available id={offering.id}")
            print(f"    INFO: The report dropdown should be using id={offering.id}, not 1")
except Exception as e:
    print(f"    FAIL — {type(e).__name__}: {e}")

# ── 4. Check Enrollment.status field exists ──────────────────
print("\n[4] Checking Enrollment.status field exists...")
try:
    from attendance.models import Enrollment
    from django.db import connection
    cols = [col.name for col in connection.introspection.get_table_description(
        connection.cursor(), 'attendance_enrollment'
    )]
    if 'status' in cols:
        print("    OK — Enrollment.status column exists in DB")
    else:
        print("    FAIL — Enrollment.status column MISSING from DB")
        print("    FIX: Run: python manage.py migrate")
except Exception as e:
    print(f"    FAIL — {type(e).__name__}: {e}")

# ── 5. Try actually calling get_course_offering_summary ───────
print("\n[5] Trying get_course_offering_summary on first offering...")
try:
    from attendance.models import CourseOffering
    from attendance.reports import get_course_offering_summary
    offering = CourseOffering.objects.first()
    if offering:
        summary = get_course_offering_summary(offering)
        print(f"    OK — Summary generated, {len(summary)} students")
        if len(summary) == 0:
            print("    NOTE: 0 students — check enrollments for this offering's section")
    else:
        print("    SKIP — No offerings to test")
except Exception as e:
    import traceback
    print(f"    FAIL — {type(e).__name__}: {e}")
    traceback.print_exc()

# ── 6. Check AttendanceRecord.session_type field exists ───────
print("\n[6] Checking AttendanceRecord.session_type field exists...")
try:
    from django.db import connection
    cols = [col.name for col in connection.introspection.get_table_description(
        connection.cursor(), 'attendance_attendancerecord'
    )]
    if 'session_type' in cols:
        print("    OK — session_type column exists")
    else:
        print("    FAIL — session_type column MISSING")
        print("    FIX: Run: python manage.py migrate")
    if 'recorded_by_id' in cols:
        print("    OK — recorded_by column exists")
    else:
        print("    FAIL — recorded_by column MISSING")
        print("    FIX: Run: python manage.py migrate")
except Exception as e:
    print(f"    FAIL — {type(e).__name__}: {e}")

print("\n" + "=" * 60)
print("Diagnostic complete. Share the output above.")
print("=" * 60)