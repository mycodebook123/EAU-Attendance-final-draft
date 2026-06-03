from django.contrib import admin
from .models import (
    User, Programme, Course, AcademicYear, Semester,
    Section, Student, Enrollment, CourseOffering,
    AttendanceRecord, Notification, SystemSettings
)

admin.site.register(User)
admin.site.register(Programme)
admin.site.register(Course)
admin.site.register(AcademicYear)
admin.site.register(Semester)
admin.site.register(Section)
admin.site.register(Student)
admin.site.register(Enrollment)
admin.site.register(CourseOffering)
admin.site.register(AttendanceRecord)
admin.site.register(Notification)
admin.site.register(SystemSettings)
