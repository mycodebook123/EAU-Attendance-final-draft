import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { GraduationCap, Shield, ClipboardList, Users } from "lucide-react";
import eauLogo from "@/assets/eau-logo.png";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6">
      <div className="animate-fade-in text-center max-w-md">
        <img src={eauLogo} alt="Ethiopian Aviation University Logo" className="h-28 mx-auto mb-6 object-contain" />
        <h1 className="font-display text-3xl font-bold text-foreground mb-2">
          EAU Attendance Automator
        </h1>
        <p className="text-muted-foreground mb-8">
          Ethiopian Aviation University — Student attendance tracking and automated notification system.
        </p>

        <div className="grid gap-3">
          <Button
            onClick={() => navigate("/login")}
            className="w-full gap-2"
            size="lg"
          >
            <Shield className="w-4 h-4" />
            Sign In to Portal
          </Button>
        </div>

        <p className="text-xs text-muted-foreground mt-8">
          © 2026 Ethiopian Aviation University. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default Index;
