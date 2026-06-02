import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { loginApi, getMeApi } from "../api/axios";

interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  is_staff?: boolean;
  is_superuser?: boolean;
}

interface AuthContextType {
  user: User | null;
  role: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  signOut: () => void;
  isAuthenticated: boolean;
  profileId: number | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // sessionStorage is tab-isolated — different tabs can hold different sessions.
    // Fall back to localStorage for tokens written before this fix was applied.
    const token =
      sessionStorage.getItem("access_token") ||
      localStorage.getItem("access_token");

    if (token) {
      // Promote to sessionStorage so this tab owns its own copy
      sessionStorage.setItem("access_token", token);
      const refresh =
        sessionStorage.getItem("refresh_token") ||
        localStorage.getItem("refresh_token");
      if (refresh) sessionStorage.setItem("refresh_token", refresh);

      getMeApi()
        .then((res) => {
          // Role comes only from the API response — never re-read from storage,
          // so changing role in another tab cannot affect this one.
          setUser(res.data);
        })
        .catch(() => {
          sessionStorage.clear();
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (username: string, password: string) => {
    const res = await loginApi(username, password);
    // Write to sessionStorage (tab-scoped) + localStorage (for axios interceptor compat)
    sessionStorage.setItem("access_token", res.data.access);
    sessionStorage.setItem("refresh_token", res.data.refresh);
    localStorage.setItem("access_token", res.data.access);
    localStorage.setItem("refresh_token", res.data.refresh);
    // NOTE: we do NOT write user_role to storage — role lives in React state only
    setUser(res.data.user);
  };

  const logout = () => {
    sessionStorage.clear();
    localStorage.clear();
    setUser(null);
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        // Derived from in-memory state — tab-safe
        role: user?.role ?? null,
        loading,
        login,
        logout,
        signOut: logout,
        isAuthenticated: !!user,
        profileId: user?.id ?? null,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};