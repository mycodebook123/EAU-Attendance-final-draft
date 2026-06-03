# backend/attendance/migrations/0007_courseoffering_session_type.py
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('attendance', '0006_attendancerecord_comment'),
    ]

    operations = [
        # Step 1: Add session_type field to CourseOffering (nullable first)
        migrations.AddField(
            model_name='courseoffering',
            name='session_type',
            field=models.CharField(
                max_length=15,
                choices=[('theory', 'Theory'), ('practical', 'Practical')],
                default='theory',
            ),
        ),
        # Step 2: Remove old unique_together (course + section was implicitly
        # enforced via get_or_create — no DB constraint existed, so this is safe)
        # Step 3: Add new unique_together (course + section + session_type)
        migrations.AlterUniqueTogether(
            name='courseoffering',
            unique_together={('course', 'section', 'session_type')},
        ),
    ]