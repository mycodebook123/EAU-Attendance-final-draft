from django.core.mail import send_mail
from decouple import config


def send_email(to_email, subject, body):
    try:
        send_mail(
            subject=subject,
            message='',
            from_email=config('DEFAULT_FROM_EMAIL'),
            recipient_list=[to_email],
            html_message=body,
            fail_silently=False,
        )
        return True
    except Exception as e:
        print(f"Email error: {e}")
        return None


def send_absence_alert(student, course, date):
    subject = f"Absence Alert — {course.name}"

    body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #1B3A6B; padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">EAU Attendance System</h1>
        </div>
        <div style="padding: 30px; background-color: #f9f9f9;">
            <h2 style="color: #e74c3c;">Absence Notification</h2>
            <p>Dear {student.full_name},</p>
            <p>This is to inform you that you were marked <strong>absent</strong> 
            from the following class:</p>
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <tr style="background-color: #1B3A6B; color: white;">
                    <td style="padding: 10px;">Course</td>
                    <td style="padding: 10px;">{course.name}</td>
                </tr>
                <tr style="background-color: #f2f2f2;">
                    <td style="padding: 10px;">Date</td>
                    <td style="padding: 10px;">{date}</td>
                </tr>
                <tr>
                    <td style="padding: 10px;">Student ID</td>
                    <td style="padding: 10px;">{student.student_id}</td>
                </tr>
            </table>
            <p>Please ensure you maintain the minimum required attendance to remain 
            eligible for the final examination.</p>
            <p style="color: #666; font-size: 12px;">
                This is an automated message from the EAU Attendance Management System.
            </p>
        </div>
    </div>
    """

    # Send to student
    send_email(student.email, subject, body)

    # Send to parent
    parent_subject = f"Absence Alert — {student.full_name} — {course.name}"
    parent_body = body.replace(
        f"Dear {student.full_name}",
        f"Dear Parent/Guardian of {student.full_name}"
    )
    send_email(student.parent_email, parent_subject, parent_body)


def send_threshold_warning(student, course, attended_hours, minimum_hours):
    subject = f"Attendance Warning — {course.name}"
    percentage = round(
        (float(attended_hours) / float(course.total_credit_hours)) * 100, 1
    )

    body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #1B3A6B; padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">EAU Attendance System</h1>
        </div>
        <div style="padding: 30px; background-color: #f9f9f9;">
            <h2 style="color: #f39c12;">Attendance Threshold Warning</h2>
            <p>Dear {student.full_name},</p>
            <p>Your attendance in <strong>{course.name}</strong> is approaching 
            the minimum required threshold.</p>
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <tr style="background-color: #1B3A6B; color: white;">
                    <td style="padding: 10px;">Course</td>
                    <td style="padding: 10px;">{course.name}</td>
                </tr>
                <tr style="background-color: #f2f2f2;">
                    <td style="padding: 10px;">Hours Attended</td>
                    <td style="padding: 10px;">{attended_hours} hours</td>
                </tr>
                <tr>
                    <td style="padding: 10px;">Minimum Required</td>
                    <td style="padding: 10px;">{minimum_hours} hours</td>
                </tr>
                <tr style="background-color: #f2f2f2;">
                    <td style="padding: 10px;">Current Attendance</td>
                    <td style="padding: 10px; color: #e74c3c;">
                        <strong>{percentage}%</strong>
                    </td>
                </tr>
            </table>
            <div style="background-color: #fff3cd; padding: 15px;
                        border-left: 4px solid #f39c12; margin: 20px 0;">
                <p style="margin: 0;">
                    <strong>Action Required:</strong> Please attend all upcoming 
                    classes to maintain eligibility for the final examination.
                </p>
            </div>
            <p style="color: #666; font-size: 12px;">
                This is an automated message from the EAU Attendance Management System.
            </p>
        </div>
    </div>
    """

    send_email(student.email, subject, body)
    send_email(student.parent_email, subject, body.replace(
        f"Dear {student.full_name}",
        f"Dear Parent/Guardian of {student.full_name}"
    ))