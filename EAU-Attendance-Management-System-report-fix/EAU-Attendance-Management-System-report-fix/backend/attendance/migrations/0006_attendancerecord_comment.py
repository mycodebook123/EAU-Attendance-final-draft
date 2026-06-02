from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('attendance', '0005_add_department_model'),
    ]

    operations = [
        migrations.AddField(
            model_name='attendancerecord',
            name='comment',
            field=models.CharField(
                blank=True, default='', max_length=300,
                help_text='Optional reason shown for excused absences.',
            ),
        ),
    ]