import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "sams.settings")
django.setup()

from django.test import Client
from rest_framework_simplejwt.tokens import RefreshToken
from attendance.models import User, Course, Programme

# Create user
user, _ = User.objects.get_or_create(username='testadmin', defaults={'role':'admin'})
# Create programme
prog, _ = Programme.objects.get_or_create(name='Test Prog', code='TP')
# Create course
course, _ = Course.objects.get_or_create(id=1, defaults={'name':'Test', 'total_credit_hours': 10, 'programme': prog})

refresh = RefreshToken.for_user(user)
token = refresh.access_token

client = Client()
res = client.get(f'/api/reports/course/{course.id}/', HTTP_AUTHORIZATION=f'Bearer {token}')
print("STATUS CODE:", res.status_code)
print("CONTENT:", res.content)
