import { Users, BookOpen, ClipboardList, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface StatsCardsProps {
  totalStudents: number;
  totalCourses: number;
  atRiskCount: number;
  totalRecords: number;
}

const StatsCards = ({ totalStudents, totalCourses, atRiskCount, totalRecords }: StatsCardsProps) => {
  const stats = [
    {
      label: "Total Students",
      value: totalStudents,
      change: "enrolled this semester",
      changeType: "neutral" as const,
      icon: Users,
      color: "bg-eau-crimson-light text-primary",
    },
    {
      label: "Active Courses",
      value: totalCourses,
      change: "running this semester",
      changeType: "neutral" as const,
      icon: BookOpen,
      color: "bg-eau-mustard-light text-secondary-foreground",
    },
    {
      label: "Attendance Records",
      value: totalRecords,
      change: "total logged",
      changeType: "neutral" as const,
      icon: ClipboardList,
      color: "bg-eau-green-light text-accent",
    },
    {
      label: "At-Risk Students",
      value: atRiskCount,
      change: "with absences exceeding threshold",
      changeType: atRiskCount > 0 ? "negative" as const : "positive" as const,
      icon: AlertTriangle,
      color: "bg-destructive/10 text-destructive",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.label} className="shadow-card border-border/50 animate-fade-in">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-display font-bold mt-1">{stat.value}</p>
                  <p className={`text-xs mt-1 font-medium ${
                    stat.changeType === "positive" ? "text-accent" :
                    stat.changeType === "negative" ? "text-destructive" :
                    "text-muted-foreground"
                  }`}>
                    {stat.change}
                  </p>
                </div>
                <div className={`p-2.5 rounded-xl ${stat.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default StatsCards;
