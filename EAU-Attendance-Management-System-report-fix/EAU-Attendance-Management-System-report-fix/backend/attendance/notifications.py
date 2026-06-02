import requests
from django.core.mail import send_mail
from django.conf import settings
from decouple import config

def send_attendance_alert(attendance_record):
    """
    Sends Email and Telegram notifications to parents when a student is absent.
    """
    student = attendance_record.student
    course_name = attendance_record.course_offering.course.name
    parent_email = student.parent_email
    parent_telegram_id = student.parent_telegram
    
    # Using student.first_name + last_name since 'full_name' might not be a field
    # If your model has a full_name property, you can change this back.
    student_display_name = f"{student.first_name} {student.last_name}"
    
    # Define the message content
    subject = f"Attendance Alert: {student_display_name} is Absent"
    
    message = (
        f"Dear Parent/Guardian,\n\n"
        f"This is an automated notification from EAU Attendance System.\n\n"
        f"Student: {student_display_name} ({student.student_id})\n"
        f"Status: ABSENT\n"
        f"Course: {course_name}\n"
        f"Date: {attendance_record.date}\n\n"
        f"Please ensure the student attends their next session or provide a valid excuse to the department."
    )

    # 1. Send Email via Gmail SMTP
    if parent_email:
        try:
            send_mail(
                subject,
                message,
                config('DEFAULT_FROM_EMAIL', default=settings.DEFAULT_FROM_EMAIL),
                [parent_email],
                fail_silently=False,
            )
            print(f"DEBUG: Email successfully sent to {parent_email}")
        except Exception as e:
            print(f"DEBUG: Email failed for {student_display_name}: {e}")

    # 2. Send Telegram via Bot API
    if parent_telegram_id:
        # It uses your new token from your .env or the hardcoded fallback
        token = config('TELEGRAM_BOT_TOKEN', default='8474266701:AAEjsXjHQUuAU8kmKRST1JkSMsCVwlpAT7Y')
        url = f"https://api.telegram.org/bot{token}/sendMessage"
        
        # Note: parent_telegram_id must be a numeric ID (e.g. 12345678)
        payload = {
            'chat_id': parent_telegram_id,
            'text': f"🔔 *{subject}*\n\n{message}",
            'parse_mode': 'Markdown'
        }
        
        try:
            response = requests.post(url, data=payload)
            if response.status_code == 200:
                print(f"DEBUG: Telegram alert sent to ID {parent_telegram_id}")
            else:
                # This will show us if the Chat ID is wrong or the Bot was never 'Started'
                print(f"DEBUG: Telegram API Error: {response.text}")
        except Exception as e:
            print(f"DEBUG: Telegram connection failed: {e}")