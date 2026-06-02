import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { toast } from "sonner";
import eauLogo from "@/assets/eau-logo.png";

const Login = () => {
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(identifier, password);
      const role = localStorage.getItem("user_role");
      toast.success("Logged in successfully");
      if (role === "admin" || role === "dean" || role === "dept_head") {
        window.location.href = "/admin";
      } else if (role === "teacher") {
        window.location.href = "/teacher";
      } else if (role === "student") {
        window.location.href = "/student";
      } else if (role === "parent") {
        window.location.href = "/parent";
      } else {
        window.location.href = "/teacher";
      }
    } catch (err: any) {
      toast.error(
        "Invalid credentials. Please check your Staff ID / Email and password.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md shadow-elevated animate-fade-in">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img
              src={eauLogo}
              alt="Ethiopian Aviation University"
              className="h-24 object-contain"
            />
          </div>
          <CardTitle className="font-display text-xl">
            EAU Attendance System
          </CardTitle>
          <CardDescription>Sign in to access your portal</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label htmlFor="identifier">Staff ID or Email</Label>
              <Input
                id="identifier"
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="e.g. TCH001 or your email"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
          <p className="text-center text-muted-foreground text-xs mt-6">
            Contact your administrator if you need access
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
