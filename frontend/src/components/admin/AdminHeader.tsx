import { useState, useEffect, useRef } from "react";
import { Menu, Bell, Search, X, Users, BookOpen, LogOut, User, Settings, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";

// Notification type defined locally — no import from AdminDashboard
interface Notification {
  id: number;
  message: string;
  notification_type: string;
  created_at: string;
}

interface SearchResult {
  id: number | string;
  label: string;
  sub: string;
  tab: "students" | "courses";
  icon: "student" | "course";
}

interface AdminHeaderProps {
  title: string;
  onMenuToggle?: () => void;
  onNavigate?: (tab: string) => void;
  notifications: Notification[];
  onMarkRead: (id: number) => void;
  students?: { id: number; full_name: string; student_id: string }[];
  courses?: { id: number; name: string; code?: string }[];
}

const roleLabel: Record<string, string> = {
  admin: "Administrator",
  dean: "Dean",
  dept_head: "Department Head",
  teacher: "Teacher",
  student: "Student",
};

const AdminHeader = ({
  title,
  onMenuToggle,
  onNavigate,
  notifications,
  onMarkRead,
  students = [],
  courses = [],
}: AdminHeaderProps) => {
  const { user, role, signOut } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node))
        setShowNotifications(false);
      if (searchRef.current && !searchRef.current.contains(e.target as Node))
        setShowResults(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node))
        setShowProfile(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Search
  useEffect(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }
    const studentMatches: SearchResult[] = students
      .filter(
        (s) =>
          s.full_name.toLowerCase().includes(q) ||
          s.student_id.toLowerCase().includes(q),
      )
      .slice(0, 5)
      .map((s) => ({ id: s.id, label: s.full_name, sub: s.student_id, tab: "students", icon: "student" }));
    const courseMatches: SearchResult[] = courses
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.code && c.code.toLowerCase().includes(q)),
      )
      .slice(0, 5)
      .map((c) => ({ id: c.id, label: c.name, sub: c.code || "Course", tab: "courses", icon: "course" }));
    setSearchResults([...studentMatches, ...courseMatches]);
    setShowResults(true);
  }, [searchQuery, students, courses]);

  const handleResultClick = (result: SearchResult) => {
    onNavigate?.(result.tab);
    setSearchQuery("");
    setSearchResults([]);
    setShowResults(false);
  };

  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults([]);
    setShowResults(false);
  };

  const initials = user?.first_name
    ? user.first_name.charAt(0).toUpperCase() + (user?.last_name?.charAt(0) || "").toUpperCase()
    : "AD";

  const fullName =
    user?.first_name || user?.last_name
      ? `${user?.first_name ?? ""} ${user?.last_name ?? ""}`.trim()
      : "User";

  const handleMarkAllRead = () => {
    notifications.forEach((n) => onMarkRead(n.id));
  };

  return (
    <header className="sticky top-0 z-30 bg-card border-b border-border px-4 lg:px-6 py-3 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenuToggle}>
          <Menu className="w-5 h-5" />
        </Button>
        <h2 className="font-display text-lg font-bold text-foreground">{title}</h2>
      </div>

      <div className="flex items-center gap-3">
        {/* Global Search */}
        <div ref={searchRef} className="hidden md:block relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search students, courses..."
            className="pl-9 pr-8 w-72 bg-muted border-none"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => searchResults.length > 0 && setShowResults(true)}
          />
          {searchQuery && (
            <button
              onClick={clearSearch}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          {showResults && searchResults.length > 0 && (
            <div className="absolute left-0 top-full mt-1.5 w-80 bg-card border border-border rounded-xl shadow-lg overflow-hidden z-50">
              {searchResults.filter((r) => r.icon === "student").length > 0 && (
                <>
                  <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide bg-muted/40 border-b border-border/50">
                    Students
                  </div>
                  {searchResults.filter((r) => r.icon === "student").map((r) => (
                    <button
                      key={`student-${r.id}`}
                      onClick={() => handleResultClick(r)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/60 transition-colors text-left"
                    >
                      <div className="p-1.5 rounded-lg bg-primary/10 flex-shrink-0">
                        <Users className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{r.label}</p>
                        <p className="text-xs text-muted-foreground font-mono">{r.sub}</p>
                      </div>
                      <span className="ml-auto text-xs text-muted-foreground flex-shrink-0">
                        → Students
                      </span>
                    </button>
                  ))}
                </>
              )}
              {searchResults.filter((r) => r.icon === "course").length > 0 && (
                <>
                  <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide bg-muted/40 border-b border-border/50 border-t border-t-border/30">
                    Courses
                  </div>
                  {searchResults.filter((r) => r.icon === "course").map((r) => (
                    <button
                      key={`course-${r.id}`}
                      onClick={() => handleResultClick(r)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/60 transition-colors text-left"
                    >
                      <div className="p-1.5 rounded-lg bg-secondary/20 flex-shrink-0">
                        <BookOpen className="w-3.5 h-3.5 text-secondary-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{r.label}</p>
                        <p className="text-xs text-muted-foreground font-mono">{r.sub}</p>
                      </div>
                      <span className="ml-auto text-xs text-muted-foreground flex-shrink-0">
                        → Courses
                      </span>
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
          {showResults && searchQuery && searchResults.length === 0 && (
            <div className="absolute left-0 top-full mt-1.5 w-80 bg-card border border-border rounded-xl shadow-lg z-50 px-4 py-6 text-center">
              <Search className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                No results for &quot;{searchQuery}&quot;
              </p>
            </div>
          )}
        </div>

        {/* Notifications */}
        <div ref={notifRef} className="relative">
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            onClick={() => { setShowNotifications(!showNotifications); setShowProfile(false); }}
          >
            <Bell className="w-5 h-5" />
            {notifications.length > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full" />
            )}
          </Button>

          {showNotifications && (
            <div className="absolute right-0 top-full mt-1 w-80 bg-card border border-border rounded-lg shadow-lg overflow-hidden z-50">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <p className="text-sm font-semibold">
                  Notifications {notifications.length > 0 && `(${notifications.length})`}
                </p>
                <div className="flex items-center gap-2">
                  {notifications.length > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="text-xs text-primary hover:underline font-medium"
                    >
                      Mark all read
                    </button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setShowNotifications(false)}
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="text-center text-muted-foreground text-sm py-6">
                    No notifications
                  </p>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className="px-4 py-3 border-b border-border/50 bg-primary/5 text-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={`font-medium text-xs leading-snug ${
                            n.notification_type === "absence"
                              ? "text-destructive"
                              : "text-foreground"
                          }`}
                        >
                          {n.message}
                        </p>
                        <button
                          onClick={() => onMarkRead(n.id)}
                          title="Mark as read"
                          className="flex-shrink-0 text-xs text-muted-foreground hover:text-destructive transition-colors ml-1"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(n.created_at).toLocaleString([], {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  ))
                )}
              </div>
              <button
                className="w-full px-4 py-2.5 text-xs text-primary hover:bg-muted transition-colors text-center font-medium"
                onClick={() => {
                  onNavigate?.("notifications");
                  setShowNotifications(false);
                }}
              >
                View All Notifications
              </button>
            </div>
          )}
        </div>

        {/* Profile dropdown */}
        <div ref={profileRef} className="relative">
          <button
            onClick={() => { setShowProfile(!showProfile); setShowNotifications(false); }}
            className="flex items-center gap-1.5 rounded-full hover:opacity-80 transition-opacity"
          >
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
              <span className="text-primary-foreground text-xs font-bold">{initials}</span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground hidden sm:block" />
          </button>

          {showProfile && (
            <div className="absolute right-0 top-full mt-1 w-56 bg-card border border-border rounded-lg shadow-lg overflow-hidden z-50">
              {/* User info */}
              <div className="px-4 py-3 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                    <span className="text-primary-foreground text-sm font-bold">{initials}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{fullName}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {roleLabel[role ?? ""] ?? role}
                    </p>
                    {(user as any)?.email && (
                      <p className="text-xs text-muted-foreground truncate">
                        {(user as any).email}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="py-1">
                <button
                  onClick={() => {
                    onNavigate?.("settings");
                    setShowProfile(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted transition-colors text-left"
                >
                  <Settings className="w-4 h-4 text-muted-foreground" />
                  Settings
                </button>
                <button
                  onClick={() => {
                    onNavigate?.("user-roles");
                    setShowProfile(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted transition-colors text-left"
                >
                  <User className="w-4 h-4 text-muted-foreground" />
                  My Profile
                </button>
              </div>

              <div className="border-t border-border py-1">
                <button
                  onClick={signOut}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-destructive/10 hover:text-destructive transition-colors text-left"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default AdminHeader;