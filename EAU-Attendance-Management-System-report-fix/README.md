# EAU-Attendance-Management-System
**Ethiopian Aviation University — Internship Project**

SAMS is a web-based portal designed to automate student attendance tracking and enforce the university's minimum 15% attendance policy.

## 🚀 Key Features
- **Role-Based Access:** Dedicated dashboards for Department Heads and Teachers.
- **Automated Scheduling:** Admins manage courses, sections, and teacher assignments.
- **Flexible Course Assignment:** Support for dual teacher assignment (Professor + PIP) per course.
- **Smart Attendance:** Teachers manually mark students present or absent by name, per session.
- **Immediate Alerts:** Students and parents receive real-time email notifications when a class is missed.
- **Threshold Warnings:** Automatic at-risk alerts sent to students and parents when approaching the minimum 15% attendance limit required for final exam eligibility.
- **Weekly Reports:** Per-course attendance reports showing hours attended and hours missed per student.

## 🛠️ Tech Stack
- **Frontend:** React.js + Tailwind CSS
- **Backend:** Django + Django REST Framework (Python)
- **Database:** PostgreSQL
- **Email Service:** SendGrid API

## 📂 Project Structure
```text
├── backend/            # Django Project (API & Logic)
├── frontend/           # React App (User Interface)
├── docs/               # Project Proposal & Database Diagrams
└── .gitignore          # Files to exclude from Git
```
