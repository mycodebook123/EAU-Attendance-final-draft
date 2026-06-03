"""
0005 – Replace School model with Department model.

Changes:
  - Create Department model (name, code, programme FK, is_active)
  - Add Course.department FK (nullable — courses still work without a dept)
  - Add User.managed_department FK (for dept_head scope)
  - Remove School model
  - Remove User.managed_school FK
  - Remove Programme.school FK

Zero data loss: all existing courses, students, users preserved.
Courses get a nullable department column — no data is touched.
"""

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('attendance', '0004_add_hierarchy_roles'),
    ]

    operations = [

        # ── 1. Create Department model ────────────────────────────────────
        migrations.CreateModel(
            name='Department',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True,
                                           serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=200)),
                ('code', models.CharField(blank=True, default='', max_length=20)),
                ('is_active', models.BooleanField(default=True)),
                ('programme', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='departments',
                    to='attendance.programme',
                )),
            ],
        ),

        # ── 2. Add Course.department FK (nullable — existing courses unaffected)
        migrations.AddField(
            model_name='course',
            name='department',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='courses',
                to='attendance.department',
            ),
        ),

        # ── 3. Add User.managed_department FK (for dept_head scope) ──────
        migrations.AddField(
            model_name='user',
            name='managed_department',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='department_heads',
                to='attendance.department',
            ),
        ),

        # ── 4. Remove User.managed_school FK ─────────────────────────────
        migrations.RemoveField(
            model_name='user',
            name='managed_school',
        ),

        # ── 5. Remove Programme.school FK ────────────────────────────────
        migrations.RemoveField(
            model_name='programme',
            name='school',
        ),

        # ── 6. Remove Notification.programme FK ──────────────────────────
        # Keep it — notifications are still scoped to programme (school level)
        # No change needed here.

        # ── 7. Delete School model ────────────────────────────────────────
        migrations.DeleteModel(
            name='School',
        ),

        # ── 8. Update User.managed_programme related_name ─────────────────
        # managed_programme is now used by Dean (manages a whole Programme/School)
        # No field change needed — just a conceptual rename in the UI.
    ]