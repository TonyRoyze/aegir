"use client";

import {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore,
  useCallback,
  ReactNode,
} from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter, usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";

import {
  subscribeSession,
  readSession,
  serverSession,
  writeSession,
} from "@/lib/session-store";
import type { FunctionReturnType } from "convex/server";
import { isPublicMeetRoute } from "@/lib/routes";

type User = FunctionReturnType<typeof api.auth.me>;

interface AuthContextType {
  user: User;
  isLoading: boolean;
  login: (token: string) => void;
  logout: () => void;
  token: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const savedToken = useSyncExternalStore(
    subscribeSession,
    readSession,
    serverSession,
  );
  const token = savedToken ?? null;
  const isInitialized = savedToken !== undefined;
  const router = useRouter();
  const pathname = usePathname();
  const publicMeetRoute = isPublicMeetRoute(pathname);

  const user = useQuery(api.auth.me, token ? { token } : "skip");
  const logoutMutation = useMutation(api.auth.logout);

  const isLoading = !isInitialized || (token !== null && user === undefined);

  const handleLogin = (newToken: string) => {
    writeSession(newToken);
    router.push("/");
  };

  const handleLogout = useCallback(async () => {
    if (token) {
      try {
        await logoutMutation({ token });
      } catch (e) {
        console.error("Logout failed", e);
      }
    }
    writeSession(null);
    if (!publicMeetRoute) router.push("/login");
  }, [token, logoutMutation, router, publicMeetRoute]);

  useEffect(() => {
    if (isLoading) return;
    // If we have a token but user is null (session expired or invalid)
    if (token && user === null) {
      handleLogout();
    }

    // Redirect if not authenticated and not on login page or public meet
    if (!token && !isLoading && pathname !== "/login" && !publicMeetRoute) {
      router.push("/login");
    }

    // Redirect to home if already authenticated and on login page
    if (token && user && pathname === "/login") {
      router.push("/");
    }
  }, [token, user, pathname, isLoading, publicMeetRoute, router, handleLogout]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 text-sm text-muted-foreground font-medium">
          Validating session...
        </p>
      </div>
    );
  }

  // If not authenticated and not on login page or public meet, show nothing while redirecting
  if (!token && pathname !== "/login" && !publicMeetRoute) {
    return null;
  }

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        login: handleLogin,
        logout: handleLogout,
        token,
      }}
    >
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
