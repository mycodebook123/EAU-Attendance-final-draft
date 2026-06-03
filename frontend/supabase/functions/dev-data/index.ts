import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { role, profileId } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (role === "teacher") {
      const { data: teacherCourses } = await supabase
        .from("teacher_courses")
        .select("course_id, courses(id, course_name, total_credit_hours)")
        .eq("teacher_id", profileId);

      const courses = teacherCourses?.map((d: any) => d.courses).filter(Boolean) || [];
      const courseIds = courses.map((c: any) => c.id);

      const { data: studentCourses } = await supabase
        .from("student_courses")
        .select("course_id, student_id, profiles!student_courses_student_id_fkey(id, full_name, university_id)")
        .in("course_id", courseIds);

      const { data: attendance } = await supabase
        .from("attendance")
        .select("*, profiles!attendance_student_id_fkey(full_name, university_id)")
        .in("course_id", courseIds)
        .order("date", { ascending: false })
        .limit(50);

      return new Response(JSON.stringify({ courses, studentCourses, attendance }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (role === "student") {
      const [profRes, attRes, scRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", profileId).single(),
        supabase.from("attendance").select("*, courses(course_name, total_credit_hours)").eq("student_id", profileId).order("date", { ascending: false }),
        supabase.from("student_courses").select("courses(id, course_name, total_credit_hours)").eq("student_id", profileId),
      ]);

      return new Response(JSON.stringify({
        profile: profRes.data,
        attendance: attRes.data || [],
        courses: scRes.data?.map((s: any) => s.courses).filter(Boolean) || [],
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (role === "parent") {
      const { data: rels } = await supabase
        .from("relationships")
        .select("student_id, profiles!relationships_student_id_fkey(id, full_name, university_id)")
        .eq("parent_id", profileId);

      const children = rels?.map((d: any) => d.profiles).filter(Boolean) || [];
      const childIds = children.map((c: any) => c.id);

      const childData: Record<string, any> = {};
      for (const childId of childIds) {
        const [profRes, attRes, scRes] = await Promise.all([
          supabase.from("profiles").select("*").eq("id", childId).single(),
          supabase.from("attendance").select("*, courses(course_name, total_credit_hours)").eq("student_id", childId).order("date", { ascending: false }),
          supabase.from("student_courses").select("courses(id, course_name, total_credit_hours)").eq("student_id", childId),
        ]);
        childData[childId] = {
          profile: profRes.data,
          attendance: attRes.data || [],
          courses: scRes.data?.map((s: any) => s.courses).filter(Boolean) || [],
        };
      }

      return new Response(JSON.stringify({ children, childData }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (role === "admin") {
      const [profiles, courses, attendance, userRoles, studentCourses, teacherCourses, relationships] = await Promise.all([
        supabase.from("profiles").select("*"),
        supabase.from("courses").select("*"),
        supabase.from("attendance").select("*, profiles!attendance_student_id_fkey(full_name, university_id), courses(course_name)").order("date", { ascending: false }),
        supabase.from("user_roles").select("*"),
        supabase.from("student_courses").select("*, profiles!student_courses_student_id_fkey(full_name), courses(course_name)"),
        supabase.from("teacher_courses").select("*, profiles!teacher_courses_teacher_id_fkey(full_name), courses(course_name)"),
        supabase.from("relationships").select("*"),
      ]);

      return new Response(JSON.stringify({
        profiles: profiles.data || [],
        courses: courses.data || [],
        attendance: attendance.data || [],
        userRoles: userRoles.data || [],
        studentCourses: studentCourses.data || [],
        teacherCourses: teacherCourses.data || [],
        relationships: relationships.data || [],
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid role" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
