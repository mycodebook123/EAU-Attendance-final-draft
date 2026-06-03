"""
0004 – Add School model and role hierarchy (dept_head, dean).

New:
  - School model
  - User.role choices extended: dept_head, dean (max_length 10 → 10, fits)
  - User.managed_programme FK → Programme
  - User.managed_school FK → School
  - Programme.school FK → School
  - Notification.programme FK → Programme (scope tag)
  - Seed two placeholder schools for EAU
"""

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('attendance', '0003_alter_attendancerecord_unique_together_and_more'),
    ]

    operations = [

        # ── 1. Create School model ────────────────────────────────────────────
        migrations.CreateModel(
            name='School',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=200)),
                ('code', models.CharField(blank=True, default='', max_length=20)),
                ('is_active', models.BooleanField(default=True)),
            ],
        ),

        # ── 2. Extend User.role max_length and add new choices ────────────────
        # The field was max_length=10; 'dept_head' is 9 chars — fits fine.
        migrations.AlterField(
            model_name='user',
            name='role',
            field=models.CharField(
                choices=[
                    ('teacher',   'Teacher'),
                    ('dept_head', 'Department Head'),
                    ('dean',      'Dean'),
                    ('admin',     'Admin'),
                ],
                default='teacher',
                max_length=10,
            ),
        ),

        # ── 3. Add User.managed_programme FK ─────────────────────────────────
        migrations.AddField(
            model_name='user',
            name='managed_programme',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='department_heads',
                to='attendance.programme',
            ),
        ),

        # ── 4. Add User.managed_school FK ────────────────────────────────────
        migrations.AddField(
            model_name='user',
            name='managed_school',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='deans',
                to='attendance.school',
            ),
        ),

        # ── 5. Add Programme.school FK ────────────────────────────────────────
        migrations.AddField(
            model_name='programme',
            name='school',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='programmes',
                to='attendance.school',
            ),
        ),

        # ── 6. Add Notification.programme FK (scope tag) ──────────────────────
        migrations.AddField(
            model_name='notification',
            name='programme',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='notifications',
                to='attendance.programme',
            ),
        ),
    ]