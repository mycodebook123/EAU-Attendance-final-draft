import os
import django
import random
from datetime import date, timedelta

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sams.settings')
django.setup()

from django.contrib.auth.hashers import make_password
from attendance.models import (
    User,
    School,
    Programme,
    Course,
    AcademicYear,
    Semester,
    Section,
    Student,
    Enrollment,
    CourseOffering,
    AttendanceRecord,
    Notification,
)

print("Clearing old data...")
AttendanceRecord.objects.all().delete()
CourseOffering.objects.all().delete()
Enrollment.objects.all().delete()
Notification.objects.all().delete()
Student.objects.all().delete()
Section.objects.all().delete()
Semester.objects.all().delete()
AcademicYear.objects.all().delete()
Course.objects.all().delete()
Programme.objects.all().delete()
School.objects.all().delete()
User.objects.filter(is_superuser=False).delete()

print("Creating schools...")
school_aerospace = School.objects.create(name="School of Aerospace Engineering", code="AERO")
school_aviation = School.objects.create(name="School of Aviation Management", code="AVM")
school_maintenance = School.objects.create(name="School of Aircraft Maintenance", code="MAINT")

print("Creating programmes...")
prog_aero = Programme.objects.create(
    name="BSc Aeronautical Engineering",
    duration_years=5,
    code="AERO",
    school=school_aerospace,
)
prog_maintenance = Programme.objects.create(
    name="BSc Aircraft Maintenance Engineering",
    duration_years=4,
    code="MAINT",
    school=school_maintenance,
)
prog_management = Programme.objects.create(
    name="BSc Aviation Management & Operations",
    duration_years=4,
    code="MGMT",
    school=school_aviation,
)

print("Creating academic year + semester...")
ay = AcademicYear.objects.create(
    name="2024/25",
    start_date=date(2024, 9, 1),
    end_date=date(2025, 8, 31),
    is_current=True,
)
sem2 = Semester.objects.create(
    academic_year=ay,
    number=2,
    start_date=date(2025, 2, 1),
    end_date=date(2025, 6, 30),
    is_current=True,
)

print("Creating teachers...")
teachers = []
teacher_data = [
    ("Abebe", "Girma", "teacher1"),
    ("Mekdes", "Tadesse", "teacher2"),
    ("Dawit", "Bekele", "teacher3"),
    ("Tigist", "Haile", "teacher4"),
    ("Samuel", "Tesfaye", "teacher5"),
]
for fn, ln, un in teacher_data:
    t = User.objects.create(
        username=un,
        first_name=fn,
        last_name=ln,
        email=f"{un}@eau.edu.et",
        role='teacher',
        password=make_password('teacher123')
    )
    teachers.append(t)

print("Creating admin user...")
admin_user, created = User.objects.get_or_create(
    username="admin",
    defaults={
        "first_name": "System",
        "last_name": "Admin",
        "email": "admin@eau.edu.et",
        "role": "admin",
        "password": make_password("admin123"),
    },
)
# If an `admin` user already exists (often created by `createsuperuser`),
# ensure it can log into the app's admin portal.
if not created:
    admin_user.first_name = admin_user.first_name or "System"
    admin_user.last_name = admin_user.last_name or "Admin"
    admin_user.email = admin_user.email or "admin@eau.edu.et"
    if not admin_user.is_superuser:
        admin_user.role = "admin"
    admin_user.password = make_password("admin123")
    admin_user.save()

print("Creating courses...")
# BSc Aeronautical Engineering courses
aero_courses = [
    ("Mathematics I", "AERO101", 1, 48.0),
    ("Physics I", "AERO102", 1, 48.0),
    ("Introduction to Aviation", "AERO103", 1, 32.0),
    ("Mathematics II", "AERO104", 1, 48.0),
    ("Physics II", "AERO105", 1, 48.0),
    ("Aerodynamics I", "AERO201", 2, 48.0),
    ("Thermodynamics", "AERO202", 2, 48.0),
    ("Aircraft Structures I", "AERO203", 2, 40.0),
    ("Aerodynamics II", "AERO204", 2, 48.0),
    ("Aircraft Structures II", "AERO205", 2, 40.0),
    ("Flight Mechanics", "AERO301", 3, 48.0),
    ("Propulsion Systems", "AERO302", 3, 48.0),
    ("Aviation Safety", "AERO303", 3, 32.0),
    ("Flight Navigation", "AERO401", 4, 40.0),
    ("Aircraft Systems", "AERO402", 4, 56.0),
    ("Final Year Project", "AERO501", 5, 64.0),
]

# BSc Aircraft Maintenance Engineering courses
maintenance_courses = [
    ("Engineering Mathematics", "MAINT101", 1, 48.0),
    ("Basic Electricity", "MAINT102", 1, 40.0),
    ("Aircraft Materials", "MAINT201", 2, 40.0),
    ("Airframe Maintenance", "MAINT202", 2, 48.0),
    ("Engine Maintenance", "MAINT301", 3, 48.0),
    ("Avionics Systems", "MAINT302", 3, 40.0),
    ("Aircraft Inspection", "MAINT401", 4, 48.0),
    ("Maintenance Management", "MAINT402", 4, 40.0),
]

# BSc Aviation Management courses
management_courses = [
    ("Introduction to Management", "MGMT101", 1, 40.0),
    ("Aviation Economics", "MGMT102", 1, 40.0),
    ("Airport Operations", "MGMT201", 2, 40.0),
    ("Airline Management", "MGMT202", 2, 40.0),
    ("Aviation Law", "MGMT301", 3, 32.0),
    ("Air Traffic Management", "MGMT302", 3, 40.0),
    ("Strategic Management", "MGMT401", 4, 40.0),
    ("Aviation Safety Management", "MGMT402", 4, 32.0),
]

created_courses = {"aero": {}, "maint": {}, "mgmt": {}}

for name, code, year, hours in aero_courses:
    c = Course.objects.create(
        name=name, code=code, programme=prog_aero,
        year=year, total_credit_hours=hours
    )
    created_courses["aero"][(year, code)] = c

for name, code, year, hours in maintenance_courses:
    c = Course.objects.create(
        name=name, code=code, programme=prog_maintenance,
        year=year, total_credit_hours=hours
    )
    created_courses["maint"][(year, code)] = c

for name, code, year, hours in management_courses:
    c = Course.objects.create(
        name=name, code=code, programme=prog_management,
        year=year, total_credit_hours=hours
    )
    created_courses["mgmt"][(year, code)] = c

print("Creating sections...")
# Current: Year 2, Semester 2, Academic Year 2024/25
CURRENT_YEAR = 2

sections = {}
for prog, prog_obj in [("aero", prog_aero), ("maint", prog_maintenance), ("mgmt", prog_management)]:
    for section_name in ["A", "B"]:
        s = Section.objects.create(
            name=section_name,
            programme=prog_obj,
            year=CURRENT_YEAR,
            semester=sem2,
        )
        sections[(prog, section_name)] = s

print("Creating course offerings...")
# Offer Year 2 courses to sections for the current semester
aero_y2s2_courses = [
    c for (y, code), c in created_courses["aero"].items()
    if y == CURRENT_YEAR
]
maint_y2s2_courses = [
    c for (y, code), c in created_courses["maint"].items()
    if y == CURRENT_YEAR
]
mgmt_y2s2_courses = [
    c for (y, code), c in created_courses["mgmt"].items()
    if y == CURRENT_YEAR
]

def create_offerings(course_list, section_a, section_b, teacher_list):
    offerings = []
    for i, course in enumerate(course_list):
        teacher = teacher_list[i % len(teacher_list)]
        for section in [section_a, section_b]:
            offerings.append(
                CourseOffering.objects.create(
                    course=course,
                    teacher=teacher,
                    section=section,
                )
            )
    return offerings

offerings_aero = create_offerings(
    aero_y2s2_courses,
    sections[("aero", "A")],
    sections[("aero", "B")],
    teachers[:2]
)
offerings_maint = create_offerings(
    maint_y2s2_courses,
    sections[("maint", "A")],
    sections[("maint", "B")],
    teachers[2:4]
)
offerings_mgmt = create_offerings(
    mgmt_y2s2_courses,
    sections[("mgmt", "A")],
    sections[("mgmt", "B")],
    [teachers[4]]
)

print("Creating students...")
ethiopian_names = [
    ("Abebe", "Girma"), ("Tigist", "Haile"), ("Dawit", "Bekele"),
    ("Sara", "Tadesse"), ("Yonas", "Tesfaye"), ("Kidist", "Alemayehu"),
    ("Bereket", "Wolde"), ("Marta", "Kebede"), ("Solomon", "Desta"),
    ("Hanna", "Mekonnen"), ("Tewodros", "Alemu"), ("Selam", "Girma"),
    ("Natnael", "Tekle"), ("Bethlehem", "Hailu"), ("Robel", "Yosef"),
    ("Abrham", "Mulugeta"), ("Tigist", "Assefa"), ("Kaleb", "Negash"),
    ("Eden", "Teshome"), ("Mikias", "Worku"), ("Lidya", "Getnet"),
    ("Henok", "Desta"), ("Rahel", "Tsegaye"), ("Fitsum", "Bekele"),
    ("Mahlet", "Girma"), ("Yared", "Haile"), ("Saron", "Tadesse"),
    ("Biruk", "Mekonnen"), ("Azeb", "Alemu"), ("Daniel", "Kebede"),
]

student_counter = 1

def create_students(section, programme, count=10):
    global student_counter
    students = []
    for i in range(count):
        fn, ln = ethiopian_names[(student_counter - 1) % len(ethiopian_names)]
        reg_no = f"UGR/{10000 + student_counter}/24"
        email = f"ugr{10000 + student_counter}@eau.edu.et"
        st = Student.objects.create(
            first_name=fn,
            last_name=ln,
            student_id=reg_no,
            email=email,
            parent_email=f"parent{student_counter}@gmail.com",
            parent_telegram="",
            programme=programme,
        )
        Enrollment.objects.create(student=st, section=section, status="active")
        students.append(st)
        student_counter += 1
    return students

aero_a_students = create_students(sections[("aero", "A")], prog_aero, 10)
aero_b_students = create_students(sections[("aero", "B")], prog_aero, 10)
maint_a_students = create_students(sections[("maint", "A")], prog_maintenance, 10)
maint_b_students = create_students(sections[("maint", "B")], prog_maintenance, 10)
mgmt_a_students = create_students(sections[("mgmt", "A")], prog_management, 10)
mgmt_b_students = create_students(sections[("mgmt", "B")], prog_management, 10)

print("Creating attendance records...")

def create_attendance(students, offerings, weeks=3):
    today = date.today()
    records_created = 0
    for week in range(weeks):
        for day_offset in [0, 2, 4]:  # Mon, Wed, Fri
            record_date = today - timedelta(weeks=week, days=day_offset)
            if record_date > today:
                continue
            for offering in offerings:
                for student in students:
                    # Make some students at-risk
                    if student.student_id in [
                        "UGR/10005/24", "UGR/10006/24",
                        "UGR/10015/24", "UGR/10025/24"
                    ]:
                        status = random.choices(
                            ['present', 'absent', 'excused', 'late'],
                            weights=[0.85, 0.05, 0.05, 0.05],
                        )[0]
                    else:
                        status = random.choices(
                            ['present', 'late', 'excused', 'absent'],
                            weights=[75, 10, 10, 5]
                        )[0]

                    hours = float(offering.course.total_credit_hours) / 30
                    AttendanceRecord.objects.create(
                        student=student,
                        course_offering=offering,
                        date=record_date,
                        status=status,
                        session_type='theory',
                        hours_attended=round(hours, 1),
                        recorded_by=teachers[0]
                    )
                    records_created += 1
    return records_created

total_records = 0
total_records += create_attendance(aero_a_students, offerings_aero)
total_records += create_attendance(aero_b_students, offerings_aero)
total_records += create_attendance(maint_a_students, offerings_maint)
total_records += create_attendance(maint_b_students, offerings_maint)
total_records += create_attendance(mgmt_a_students, offerings_mgmt)
total_records += create_attendance(mgmt_b_students, offerings_mgmt)

print(f"""
✅ Seeding complete!
   Schools:      3
   Programmes:   3
   Courses:      {Course.objects.count()}
   AcademicYear: {AcademicYear.objects.count()} (current={AcademicYear.objects.filter(is_current=True).count()})
   Semesters:    {Semester.objects.count()} (current={Semester.objects.filter(is_current=True).count()})
   Sections:     {Section.objects.count()} (Year 2, Sem 2, A & B per programme)
   Offerings:    {CourseOffering.objects.count()}
   Teachers:     {User.objects.filter(role='teacher').count()}
   Students:     {Student.objects.count()} (10 per section)
   Attendance:   {total_records} records
   
   Teacher logins: teacher1-5 / teacher123
   Admin login:    admin / admin123
""")