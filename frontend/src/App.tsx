import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import Login from "./pages/Login";
import AdminDashboard from "./pages/AdminDashboard";
import TeacherDashboard from "./pages/TeacherDashboard";
import StudentDashboard from "./pages/StudentDashboard";
import ParentDashboard from "./pages/ParentDashboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();
const ELEVATED_ROLES = ["admin", "dean", "dept_head"];
const isElevated = (user: any, role: string | null) =>
  !!user && (user.is_superuser || user.is_staff || (role ? ELEVATED_ROLES.includes(role) : false));

const ProtectedRoute = ({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles?: string[];
}) => {
  const { user, loading, role } = useAuth();
  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground animate-pulse">Loading...</p>
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && role && !allowedRoles.includes(role)) {
    if (isElevated(user, role)) return <Navigate to="/admin" replace />;
    if (role === "teacher") return <Navigate to="/teacher" replace />;
    if (role === "student") return <Navigate to="/student" replace />;
    if (role === "parent") return <Navigate to="/parent" replace />;
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

const RoleRouter = () => {
  const { user, loading, role } = useAuth();
  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground animate-pulse">Loading...</p>
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;
  if (isElevated(user, role)) return <Navigate to="/admin" replace />;
  if (role === "teacher") return <Navigate to="/teacher" replace />;
  if (role === "student") return <Navigate to="/student" replace />;
  if (role === "parent") return <Navigate to="/parent" replace />;
  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-center p-6">
      <div>
        <h2 className="font-display text-xl font-bold mb-2">Account Pending</h2>
        <p className="text-muted-foreground">
          Your account hasn't been assigned a role yet. Please contact
          administration.
        </p>
      </div>
    </div>
  );
};

const AppRoutes = () => {
  const { user } = useAuth();
  return (
    <Routes>
      <Route
        path="/"
        element={user ? <RoleRouter /> : <Navigate to="/login" replace />}
      />
      <Route path="/login" element={user ? <RoleRouter /> : <Login />} />
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={ELEVATED_ROLES}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teacher"
        element={
          <ProtectedRoute allowedRoles={["teacher"]}>
            <TeacherDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student"
        element={
          <ProtectedRoute allowedRoles={["student"]}>
            <StudentDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/parent"
        element={
          <ProtectedRoute allowedRoles={["parent"]}>
            <ParentDashboard />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
