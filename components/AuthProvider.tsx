"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter, usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";

type User = {
  _id: string;
  username: string;
  role: "super_admin" | "admin";
  name: string;
} | null;

interface AuthContextType {
  user: User;
  isLoading: boolean;
  login: (token: string) => void;
  logout: () => void;
  token: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const isPreviewRoute = pathname.startsWith("/preview");
  const isPublicMeetRoute = pathname.startsWith("/meets/public");

  useEffect(() => {
    const savedToken = localStorage.getItem("aegir_session");
    if (savedToken) {
      setToken(savedToken);
    }
    setIsInitialized(true);
  }, []);

  // Redirect to login if NO token is found on mount (synchronous check)
  useEffect(() => {
    if (!token && pathname !== "/login" && !isPreviewRoute && !isPublicMeetRoute) {
      router.push("/login");
    }
  }, [token, pathname, router, isPreviewRoute, isPublicMeetRoute]);

  const user = useQuery(api.auth.me, token ? { token } : "skip") as User | undefined;
  const logoutMutation = useMutation(api.auth.logout);

  const isLoading = !isInitialized || (token !== null && user === undefined);

  useEffect(() => {
    // If we have a token but user is null (session expired or invalid)
    if (token && user === null) {
      handleLogout();
    }
    
    // Redirect if not authenticated and not on login page or public meet
    if (!token && !isLoading && pathname !== "/login" && !isPreviewRoute && !isPublicMeetRoute) {
      router.push("/login");
    }

    // Redirect to home if already authenticated and on login page
    if (token && user && pathname === "/login") {
      router.push("/");
    }
  }, [token, user, pathname, isLoading, isPreviewRoute, isPublicMeetRoute]);

  const handleLogin = (newToken: string) => {
    localStorage.setItem("aegir_session", newToken);
    setToken(newToken);
    router.push("/");
  };

  const handleLogout = async () => {
    if (token) {
      try {
        await logoutMutation({ token });
      } catch (e) {
        console.error("Logout failed", e);
      }
    }
    localStorage.removeItem("aegir_session");
    setToken(null);
    router.push("/login");
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 text-sm text-muted-foreground font-medium">Validating session...</p>
      </div>
    );
  }

  // If not authenticated and not on login page or public meet, show nothing while redirecting
  if (!token && pathname !== "/login" && !isPreviewRoute && !isPublicMeetRoute) {
    return null;
  }

  return (
    <AuthContext.Provider value={{ user: user ?? null, isLoading, login: handleLogin, logout: handleLogout, token }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
