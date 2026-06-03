export const isDevBypass = () => false;
export const fetchDevData = async (_role: string, _token: string) => ({
  profiles: [], courses: [], attendance: [], userRoles: [],
  studentCourses: [], teacherCourses: [], relationships: [],
});
