import { useState, useEffect, useCallback } from "react";
import { queryClient, apiRequest } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme-provider";
import LoginPage from "@/pages/login";
import OperatorPanel from "@/pages/operator-panel";
import Dashboard from "@/pages/dashboard";
import TVDashboard from "@/pages/tv-dashboard";
import LicenseRenewal from "@/pages/license-renewal";
import type { User } from "@shared/schema";
import { getQueryFn } from "@/lib/queryClient";

type SafeUser = Omit<User, "password">;
type AppView = "login" | "operator" | "dashboard";

interface LicenseStatus {
  status: "active" | "demo" | "grace" | "expired";
  daysRemaining: number;
  expiryDate: string | null;
  message: string;
}

function AppContent() {
  const [currentUser, setCurrentUser] = useState<SafeUser | null>(null);
  const [view, setView] = useState<AppView>("login");
  const [checked, setChecked] = useState(false);
  const [operatorMachineId, setOperatorMachineId] = useState<number | null>(() => {
    const stored = sessionStorage.getItem("operatorMachineId");
    return stored ? Number(stored) : null;
  });

  const { data: sessionUser, isLoading } = useQuery<SafeUser | null>({
    queryKey: ["/api/auth/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
    staleTime: 0,
  });

  const isLoggedIn = !!(currentUser && view !== "login");

  const { data: licenseStatus } = useQuery<LicenseStatus>({
    queryKey: ["/api/license/status"],
    enabled: isLoggedIn,
    refetchInterval: 300000,
  });

  useEffect(() => {
    if (isLoading) return;
    if (sessionUser) {
      setCurrentUser(sessionUser);
      setView(sessionUser.role === "admin" ? "dashboard" : "operator");
      const serverMachineId = (sessionUser as SafeUser & { operatorMachineId?: number | null }).operatorMachineId;
      if (serverMachineId) {
        setOperatorMachineId(serverMachineId);
        sessionStorage.setItem("operatorMachineId", String(serverMachineId));
      }
    }
    setChecked(true);
  }, [sessionUser, isLoading]);

  const handleLogin = useCallback(async (user: SafeUser, machineId?: number) => {
    queryClient.clear();
    if (machineId) {
      setOperatorMachineId(machineId);
      sessionStorage.setItem("operatorMachineId", String(machineId));
    } else {
      setOperatorMachineId(null);
      sessionStorage.removeItem("operatorMachineId");
    }

    const maxRetries = 5;
    for (let i = 0; i < maxRetries; i++) {
      await new Promise((r) => setTimeout(r, 150));
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (res.ok) {
          setCurrentUser(user);
          setView(user.role === "admin" ? "dashboard" : "operator");
          return;
        }
      } catch {}
    }

    setCurrentUser(user);
    setView(user.role === "admin" ? "dashboard" : "operator");
  }, []);

  const handleBack = useCallback(async () => {
    try {
      await apiRequest("POST", "/api/auth/logout");
    } catch {}
    setCurrentUser(null);
    setOperatorMachineId(null);
    sessionStorage.removeItem("operatorMachineId");
    setView("login");
    queryClient.clear();
  }, []);

  if (!checked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground text-sm">Yukleniyor...</div>
      </div>
    );
  }

  if (view === "login" || !currentUser) {
    return <LoginPage onLogin={handleLogin} />;
  }

  if (licenseStatus?.status === "expired") {
    return <LicenseRenewal isAdmin={currentUser.role === "admin"} onLogout={handleBack} />;
  }

  if (view === "dashboard") {
    return <Dashboard user={currentUser as User} onBack={handleBack} licenseStatus={licenseStatus || null} />;
  }

  return <OperatorPanel user={currentUser as User} onBack={handleBack} initialMachineId={operatorMachineId} licenseStatus={licenseStatus || null} />;
}

function App() {
  const isTVDashboard = window.location.pathname === "/tv-dashboard";

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider>
          {isTVDashboard ? <TVDashboard /> : <AppContent />}
          <Toaster />
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
