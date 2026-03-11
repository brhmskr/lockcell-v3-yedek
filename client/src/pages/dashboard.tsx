import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useTheme } from "@/lib/theme-provider";
import {
  ArrowLeft, Moon, Sun, Activity, AlertTriangle,
  Clock, CheckCircle, Package, TrendingUp,
  Pause, Cog, Users, Settings2, LayoutDashboard,
  FileSpreadsheet, LogOut, Wallet, Gauge, Calculator,
  ChevronLeft, ChevronRight, Loader2, Hourglass, ImageIcon,
  UserCheck, MessageSquare, ShieldCheck, KeyRound,
  ClipboardList, Search, X, ListFilter,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import MachineManagement from "@/pages/admin/machine-management";
import UserManagement from "@/pages/admin/user-management";
import WorkOrderManagement from "@/pages/admin/work-order-management";
import Reports from "@/pages/admin/reports";
import StopReasonManagement from "@/pages/admin/stop-reason-management";
import OperationManagement from "@/pages/admin/operation-management";
import ExpenseManagement from "@/pages/admin/expense-management";
import MachineEfficiency from "@/pages/admin/machine-efficiency";
import Profitability from "@/pages/admin/profitability";
import OperatorAssignments from "@/pages/admin/operator-assignments";
import MachineChat from "@/pages/admin/machine-chat";
import SettingsPage from "@/pages/admin/settings";
import LicenseInfoPage from "@/pages/admin/license-info";
import OperationPlanReport from "@/pages/admin/operation-plan-report";
import EfficiencyAnalysis from "@/pages/admin/efficiency-analysis";
import lockcellLogoWhite from "@assets/lockcell-beyaz_1772012570656.webp";
import lockcellLogoDark from "@assets/lockcell_logo_1772012546609.webp";
import type { Machine, WorkOrder, Operation, ProductionLog, User, StopReason, StopLog, OperatorAssignment, RecurringExpense, WorkOrderLine, PagePermission } from "@shared/schema";

function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = "sine";
    gain.gain.value = 0.15;
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.stop(ctx.currentTime + 0.3);
  } catch {}
}

interface DashboardStats {
  machines: Machine[];
  workOrders: WorkOrder[];
  productionLogs: ProductionLog[];
  operations: Operation[];
  users: User[];
  stopReasons: StopReason[];
  stopLogs: StopLog[];
  operatorAssignments: OperatorAssignment[];
  recurringExpenses: RecurringExpense[];
  workOrderLines: WorkOrderLine[];
}

interface LicenseStatusInfo {
  status: "active" | "demo" | "grace" | "expired";
  daysRemaining: number;
  expiryDate: string | null;
  message: string;
}

interface DashboardProps {
  user: User;
  onBack: () => void;
  licenseStatus: LicenseStatusInfo | null;
}

type AdminTab = "overview" | "chat" | "machines" | "operations" | "users" | "assignments" | "workorders" | "stopreasons" | "expenses" | "reports" | "efficiency" | "profitability" | "operationPlan" | "efficiencyAnalysis" | "settings" | "license";

const allTabs: { id: AdminTab; label: string; icon: React.ReactNode }[] = [
  { id: "overview", label: "Genel Bakış", icon: <LayoutDashboard className="w-4 h-4" /> },
  { id: "chat", label: "Tezgah Chat", icon: <MessageSquare className="w-4 h-4" /> },
  { id: "machines", label: "Tezgahlar", icon: <Settings2 className="w-4 h-4" /> },
  { id: "operations", label: "Operasyonlar", icon: <Cog className="w-4 h-4" /> },
  { id: "users", label: "Personel", icon: <Users className="w-4 h-4" /> },
  { id: "assignments", label: "Operatör Atamaları", icon: <UserCheck className="w-4 h-4" /> },
  { id: "workorders", label: "İş Emirleri", icon: <Package className="w-4 h-4" /> },
  { id: "stopreasons", label: "Duruş Nedenleri", icon: <AlertTriangle className="w-4 h-4" /> },
  { id: "expenses", label: "Giderler", icon: <Wallet className="w-4 h-4" /> },
  { id: "reports", label: "Raporlar", icon: <FileSpreadsheet className="w-4 h-4" /> },
  { id: "efficiency", label: "Verimlilik", icon: <Gauge className="w-4 h-4" /> },
  { id: "profitability", label: "Kârlılık", icon: <Calculator className="w-4 h-4" /> },
  { id: "operationPlan", label: "Operasyon Planı", icon: <ClipboardList className="w-4 h-4" /> },
  { id: "efficiencyAnalysis", label: "Verimlilik Analizi", icon: <TrendingUp className="w-4 h-4" /> },
  { id: "settings", label: "Ayarlar", icon: <ShieldCheck className="w-4 h-4" /> },
  { id: "license", label: "Lisans", icon: <KeyRound className="w-4 h-4" /> },
];

export default function Dashboard({ user, onBack, licenseStatus }: DashboardProps) {
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const userAdminRole = user.adminRole || "staff";
  const isSuperAdmin = userAdminRole === "superadmin";

  const { data: pagePerms = [] } = useQuery<PagePermission[]>({
    queryKey: ["/api/page-permissions"],
  });

  const isTabAllowed = useCallback((tabId: string): boolean => {
    if (isSuperAdmin) return true;
    const perm = pagePerms.find((p) => p.pageId === tabId && p.roleName === userAdminRole);
    if (!perm) return true;
    return perm.allowed;
  }, [pagePerms, userAdminRole, isSuperAdmin]);

  const tabs = allTabs.filter((tab) => {
    if (tab.id === "license") return isSuperAdmin;
    return isTabAllowed(tab.id);
  });

  const { data: globalMachines = [] } = useQuery<Machine[]>({ queryKey: ["/api/machines"] });
  const prevUnreadRef = useRef<Record<number, number> | null>(null);
  const { data: globalUnreadCounts = {} } = useQuery<Record<number, number>>({
    queryKey: ["/api/chat/unread-counts"],
    refetchInterval: 5000,
  });

  const totalUnread = Object.values(globalUnreadCounts).reduce((sum, c) => sum + c, 0);

  useEffect(() => {
    const prev = prevUnreadRef.current;
    if (prev === null) {
      prevUnreadRef.current = { ...globalUnreadCounts };
      return;
    }
    for (const [machineIdStr, count] of Object.entries(globalUnreadCounts)) {
      const mid = Number(machineIdStr);
      const prevCount = prev[mid] || 0;
      if (count > prevCount && activeTab !== "chat") {
        const machineName = globalMachines.find(m => m.id === mid)?.name || `Tezgah #${mid}`;
        toast({ title: "Yeni mesaj", description: `${machineName} tezgahından mesaj geldi` });
        playNotificationSound();
        break;
      }
    }
    prevUnreadRef.current = { ...globalUnreadCounts };
  }, [globalUnreadCounts, globalMachines, activeTab, toast]);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 2);
  }, []);

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", checkScroll, { passive: true });
    const ro = new ResizeObserver(checkScroll);
    ro.observe(el);
    return () => { el.removeEventListener("scroll", checkScroll); ro.disconnect(); };
  }, [checkScroll]);

  const scroll = (dir: "left" | "right") => {
    scrollRef.current?.scrollBy({ left: dir === "left" ? -200 : 200, behavior: "smooth" });
  };

  const handleTabClick = (tabId: AdminTab) => {
    setActiveTab(tabId);
    const el = scrollRef.current;
    if (!el) return;
    const btn = el.querySelector(`[data-tab="${tabId}"]`) as HTMLElement | null;
    if (btn) {
      const offset = btn.offsetLeft - el.offsetLeft - el.clientWidth / 2 + btn.clientWidth / 2;
      el.scrollTo({ left: offset, behavior: "smooth" });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-card sticky top-0 z-50 shadow-sm border-b border-border/50">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 px-4 py-3">
          <div className="flex items-center gap-2">
            <img src={lockcellLogoDark} alt="Lockcell" className="h-7 object-contain dark:hidden" data-testid="img-dashboard-logo-light" />
            <img src={lockcellLogoWhite} alt="Lockcell" className="h-7 object-contain hidden dark:block" data-testid="img-dashboard-logo-dark" />
            <h1 className="font-bold text-lg hidden sm:block" data-testid="text-dashboard-title">MES</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground hidden sm:inline">{user.fullName}</span>
            <Button variant="ghost" size="icon" onClick={toggleTheme} className="rounded-full" data-testid="button-theme-toggle">
              {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full text-destructive hover:text-destructive hover:bg-destructive/10" data-testid="button-dashboard-back">
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 pb-3 relative">
          <div className="relative flex items-center">
            {canScrollLeft && (
              <button
                onClick={() => scroll("left")}
                className="absolute left-0 z-10 h-9 w-8 flex items-center justify-center bg-gradient-to-r from-card via-card to-transparent"
                data-testid="button-scroll-left"
              >
                <ChevronLeft className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
            <div
              ref={scrollRef}
              className="flex items-center gap-1 overflow-x-auto scrollbar-hide scroll-smooth"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
              data-testid="nav-admin-tabs"
            >
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    data-tab={tab.id}
                    onClick={() => handleTabClick(tab.id)}
                    className={`relative flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-all duration-200 ${
                      isActive
                        ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
                    }`}
                    data-testid={`tab-${tab.id}`}
                  >
                    {tab.icon}
                    <span>{tab.label}</span>
                    {tab.id === "chat" && totalUnread > 0 && (
                      <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full bg-destructive text-destructive-foreground animate-pulse" data-testid="badge-chat-unread">
                        {totalUnread}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {canScrollRight && (
              <button
                onClick={() => scroll("right")}
                className="absolute right-0 z-10 h-9 w-8 flex items-center justify-center bg-gradient-to-l from-card via-card to-transparent"
                data-testid="button-scroll-right"
              >
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>
      </div>

      {licenseStatus && (licenseStatus.status === "demo" || licenseStatus.status === "grace") && (
        <div
          className={`max-w-7xl mx-auto px-4 pt-4 ${licenseStatus.status === "grace" ? "" : ""}`}
          data-testid="banner-license-warning"
        >
          <div className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm ${
            licenseStatus.status === "grace"
              ? "bg-orange-500/10 border border-orange-500/30 text-orange-700 dark:text-orange-400"
              : "bg-yellow-500/10 border border-yellow-500/30 text-yellow-700 dark:text-yellow-400"
          }`}>
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{licenseStatus.message}</span>
            <span className="ml-auto font-mono font-bold whitespace-nowrap">{licenseStatus.daysRemaining} gun kaldi</span>
            <Button
              variant="outline"
              size="sm"
              className="ml-2 shrink-0"
              onClick={() => setActiveTab("license")}
              data-testid="button-go-to-license"
            >
              Lisans Bilgileri
            </Button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto p-4">
        {activeTab === "overview" && <OverviewTab onNavigate={handleTabClick} />}
        {activeTab === "chat" && <MachineChat globalUnreadCounts={globalUnreadCounts} />}
        {activeTab === "machines" && <MachineManagement />}
        {activeTab === "operations" && <OperationManagement />}
        {activeTab === "users" && <UserManagement />}
        {activeTab === "assignments" && <OperatorAssignments />}
        {activeTab === "workorders" && <WorkOrderManagement isSuperAdmin={isSuperAdmin} />}
        {activeTab === "stopreasons" && <StopReasonManagement />}
        {activeTab === "expenses" && <ExpenseManagement />}
        {activeTab === "reports" && <Reports />}
        {activeTab === "efficiency" && <MachineEfficiency />}
        {activeTab === "profitability" && <Profitability />}
        {activeTab === "operationPlan" && <OperationPlanReport />}
        {activeTab === "efficiencyAnalysis" && <EfficiencyAnalysis />}
        {activeTab === "settings" && <SettingsPage />}
        {activeTab === "license" && <LicenseInfoPage />}
      </div>

      <footer className="max-w-7xl mx-auto px-4 py-6 text-center">
        <p className="text-xs text-gray-400 dark:text-gray-500" data-testid="text-version">LOCKCELL MES v1.4</p>
      </footer>
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  running: "#22c55e",
  idle: "#6b7280",
  stopped: "#ef4444",
  broken: "#dc2626",
};

const STATUS_LABELS: Record<string, string> = {
  running: "Çalışıyor",
  idle: "Boşta",
  stopped: "Durduruldu",
  broken: "Arızalı",
};

const PIE_COLORS = ["#ef4444", "#f59e0b", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6"];

const WO_PAGE_SIZE = 12;

type TrackerWO = WorkOrder & { totalOps?: number; completedOps?: number };

function WorkOrderTracker({ onNavigate, operations }: { onNavigate: (tab: AdminTab) => void; operations: Operation[] }) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); }, [debouncedSearch, statusFilter]);

  const params = new URLSearchParams({ page: String(page), pageSize: String(WO_PAGE_SIZE) });
  if (debouncedSearch) params.set("search", debouncedSearch);
  if (statusFilter !== "all") params.set("status", statusFilter);

  const { data: woData, isLoading } = useQuery<{ data: TrackerWO[]; total: number; stats: { active: number; pending: number; completed: number } }>({
    queryKey: ["/api/work-orders", "tracker", page, debouncedSearch, statusFilter],
    queryFn: () => fetch(`/api/work-orders?${params}`, { credentials: "include" }).then(r => r.json()),
    refetchInterval: 5000,
  });

  const wos = woData?.data ?? [];
  const total = woData?.total ?? 0;
  const stats = woData?.stats ?? { active: 0, pending: 0, completed: 0 };
  const totalPages = Math.max(1, Math.ceil(total / WO_PAGE_SIZE));

  const quickFilters: { label: string; value: string; icon: React.ReactNode }[] = [
    { label: "Tümü", value: "all", icon: <ListFilter className="w-3.5 h-3.5" /> },
    { label: "Devam Edenler", value: "in_progress", icon: <Loader2 className="w-3.5 h-3.5" /> },
    { label: "Tamamlananlar", value: "completed", icon: <CheckCircle className="w-3.5 h-3.5" /> },
    { label: "Bekleyenler", value: "pending", icon: <Hourglass className="w-3.5 h-3.5" /> },
  ];

  const getStatusBadge = (wo: TrackerWO) => {
    if (wo.status === "completed") return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" data-testid={`badge-wo-status-${wo.id}`}>
        <CheckCircle className="w-3 h-3" /> Tamamlandi
      </span>
    );
    if (wo.status === "in_progress") return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400" data-testid={`badge-wo-status-${wo.id}`}>
        <Loader2 className="w-3 h-3 animate-spin" /> Devam Ediyor
      </span>
    );
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400" data-testid={`badge-wo-status-${wo.id}`}>
        <Hourglass className="w-3 h-3" /> Bekliyor
      </span>
    );
  };

  const getOpProgress = (wo: TrackerWO) => {
    const opTotal = wo.totalOps ?? wo.operationRoute?.length ?? 0;
    const opDone = wo.completedOps ?? Math.min(wo.currentOperationIndex ?? 0, opTotal);
    const opPct = opTotal > 0 ? Math.round((opDone / opTotal) * 100) : 0;
    const qtyPct = wo.targetQuantity > 0 ? Math.min(100, Math.round((wo.completedQuantity / wo.targetQuantity) * 100)) : 0;
    return { opTotal, opDone, opPct, qtyPct };
  };

  const pageNumbers: number[] = [];
  const pStart = Math.max(1, page - 2);
  const pEnd = Math.min(totalPages, pStart + 4);
  for (let i = pStart; i <= pEnd; i++) pageNumbers.push(i);

  return (
    <div className="space-y-4" data-testid="section-wo-tracker">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Package className="w-5 h-5 text-muted-foreground" />
          Is Emri Takibi
        </h2>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => onNavigate("workorders")} data-testid="button-wo-tracker-manage">
          <Settings2 className="w-3.5 h-3.5" /> Yonet
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2" data-testid="section-wo-tracker-stats">
        <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/15 border border-blue-200 dark:border-blue-800">
          <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0">
            <Activity className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground leading-none">Aktif</p>
            <p className="text-xl font-bold text-blue-600 dark:text-blue-400 leading-tight" data-testid="tracker-stat-active">{stats.active}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/15 border border-emerald-200 dark:border-emerald-800">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
            <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground leading-none">Tamamlanan</p>
            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 leading-tight" data-testid="tracker-stat-completed">{stats.completed}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 p-3 rounded-xl bg-orange-50 dark:bg-orange-900/15 border border-orange-200 dark:border-orange-800">
          <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4 text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground leading-none">Bekleyen</p>
            <p className="text-xl font-bold text-orange-600 dark:text-orange-400 leading-tight" data-testid="tracker-stat-pending">{stats.pending}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Is emri no, urun veya musteri ara..."
            className="pl-8 h-8 text-sm"
            data-testid="input-tracker-search"
          />
          {search && (
            <button className="absolute right-2 top-1/2 -translate-y-1/2" onClick={() => setSearch("")} data-testid="button-tracker-clear-search">
              <X className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {quickFilters.map((f) => (
            <Button
              key={f.value}
              variant={statusFilter === f.value ? "default" : "outline"}
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => setStatusFilter(f.value)}
              data-testid={`button-tracker-filter-${f.value}`}
            >
              {f.icon} {f.label}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      ) : wos.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          <Package className="w-10 h-10 mx-auto mb-2 opacity-20" />
          <p className="font-medium text-sm">Is emri bulunamadi.</p>
          <p className="text-xs opacity-60 mt-1">Arama kriterlerini degistirin veya yeni is emri ekleyin.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {wos.map((wo) => {
            const { opTotal, opDone, opPct, qtyPct } = getOpProgress(wo);
            const currentOpId = (wo.operationRoute || [])[wo.currentOperationIndex];
            const currentOp = currentOpId ? operations.find((o) => o.id === currentOpId) : null;
            const updatedAt = wo.updatedAt ? new Date(wo.updatedAt) : new Date(wo.createdAt);
            return (
              <Card
                key={wo.id}
                className="hover:shadow-md transition-shadow cursor-pointer border-border/60 group"
                onClick={() => onNavigate("workorders")}
                data-testid={`card-workorder-${wo.id}`}
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono font-bold text-base leading-tight truncate" data-testid={`text-wo-number-${wo.id}`}>{wo.orderNumber}</p>
                      <p className="text-xs text-foreground font-medium truncate mt-0.5">{wo.productName}</p>
                      {wo.customerName && <p className="text-[10px] text-muted-foreground truncate">{wo.customerName}</p>}
                    </div>
                    {getStatusBadge(wo)}
                  </div>

                  <div className="space-y-2">
                    <div>
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="text-muted-foreground">Uretim</span>
                        <span className="font-medium" data-testid={`text-wo-qty-${wo.id}`}>{wo.completedQuantity} / {wo.targetQuantity} adet</span>
                      </div>
                      <Progress value={qtyPct} className="h-1.5" data-testid={`progress-qty-${wo.id}`} />
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="text-muted-foreground">Operasyon</span>
                        <span className="font-medium">{opDone}/{opTotal}
                          {currentOp && wo.status !== "completed" && (
                            <span className="text-muted-foreground ml-1 font-mono">({currentOp.code})</span>
                          )}
                        </span>
                      </div>
                      <Progress value={opPct} className="h-1" data-testid={`progress-op-${wo.id}`} />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-muted-foreground border-t border-border/30 pt-2">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {getElapsedText(updatedAt)}
                    </span>
                    <span className="font-semibold text-foreground">{opPct}%</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-1" data-testid="section-tracker-pagination">
          <p className="text-xs text-muted-foreground">
            {total} is emri — Sayfa {page} / {totalPages}
          </p>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-7 px-2 gap-1 text-xs" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} data-testid="button-tracker-prev">
              <ChevronLeft className="w-3.5 h-3.5" /> Onceki
            </Button>
            {pageNumbers.map(pg => (
              <Button key={pg} variant={page === pg ? "default" : "outline"} size="sm" className="h-7 w-7 p-0 text-xs" onClick={() => setPage(pg)} data-testid={`button-tracker-page-${pg}`}>{pg}</Button>
            ))}
            <Button variant="outline" size="sm" className="h-7 px-2 gap-1 text-xs" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} data-testid="button-tracker-next">
              Sonraki <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function OverviewTab({ onNavigate }: { onNavigate: (tab: AdminTab) => void }) {
  const { data, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
    refetchInterval: 5000,
  });

  if (isLoading) return <OverviewSkeleton />;
  if (!data) return null;

  const { machines, workOrders, operations, productionLogs, users: allUsers, stopReasons, stopLogs, operatorAssignments = [], recurringExpenses = [], workOrderLines = [] } = data;

  const runningMachines = machines.filter((m) => m.status === "running").length;
  const stoppedMachines = machines.filter((m) => m.status === "stopped" || m.status === "broken").length;
  const activeWorkOrders = workOrders.filter((w) => w.status === "in_progress" || w.status === "pending").length;
  const totalTarget = workOrders.reduce((sum, wo) => sum + wo.targetQuantity, 0);
  const totalCompleted = workOrders.reduce((sum, wo) => sum + wo.completedQuantity, 0);

  const machineStatusData = [
    { name: "Çalışıyor", value: machines.filter((m) => m.status === "running").length, color: STATUS_COLORS.running },
    { name: "Boşta", value: machines.filter((m) => m.status === "idle").length, color: STATUS_COLORS.idle },
    { name: "Durduruldu", value: machines.filter((m) => m.status === "stopped").length, color: STATUS_COLORS.stopped },
    { name: "Arızalı", value: machines.filter((m) => m.status === "broken").length, color: STATUS_COLORS.broken },
  ].filter((d) => d.value > 0);

  const now = new Date();
  const stopReasonDurations: Record<number, number> = {};
  for (const sl of stopLogs) {
    const slStart = new Date(sl.startTime!);
    const slEnd = sl.endTime ? new Date(sl.endTime) : now;
    const dur = slEnd.getTime() - slStart.getTime();
    stopReasonDurations[sl.stopReasonId] = (stopReasonDurations[sl.stopReasonId] || 0) + dur;
  }

  const stopReasonPieData = Object.entries(stopReasonDurations)
    .map(([reasonId, totalMs]) => {
      const reason = stopReasons.find((r) => r.id === Number(reasonId));
      return {
        name: reason?.name || "Bilinmiyor",
        value: Math.round(totalMs / 60000),
        rawMs: totalMs,
      };
    })
    .sort((a, b) => b.value - a.value);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        <StatCard
          label="Çalışan Tezgah"
          value={runningMachines}
          total={machines.length}
          icon={<Activity className="w-5 h-5" />}
          color="text-chart-2"
        />
        <StatCard
          label="Duran Tezgah"
          value={stoppedMachines}
          total={machines.length}
          icon={<AlertTriangle className="w-5 h-5" />}
          color="text-destructive"
        />
        <StatCard
          label="Aktif İş Emirleri"
          value={activeWorkOrders}
          total={workOrders.length}
          icon={<Package className="w-5 h-5" />}
          color="text-chart-1"
        />
        <StatCard
          label="Toplam Üretim"
          value={totalCompleted}
          total={totalTarget}
          icon={<TrendingUp className="w-5 h-5" />}
          color="text-chart-4"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card data-testid="card-machine-status-chart">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Cog className="w-4 h-4 text-muted-foreground" />
              Canlı Tezgah Durumları
            </h3>
            <div className="flex items-center gap-4">
              <div className="w-40 h-40 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={machineStatusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={35}
                      outerRadius={65}
                      paddingAngle={3}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {machineStatusData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                      formatter={(value: number, name: string) => [`${value} tezgah`, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-col gap-2">
                {machineStatusData.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="text-muted-foreground">{item.name}</span>
                    <span className="font-bold">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-downtime-chart">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Pause className="w-4 h-4 text-destructive" />
              Duruş Analizi (dk)
            </h3>
            {stopReasonPieData.length > 0 ? (
              <div className="flex items-center gap-4">
                <div className="w-40 h-40 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stopReasonPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={35}
                        outerRadius={65}
                        paddingAngle={3}
                        dataKey="value"
                        strokeWidth={0}
                      >
                        {stopReasonPieData.map((_, index) => (
                          <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                        formatter={(value: number, name: string) => [`${value} dk`, name]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-col gap-2">
                  {stopReasonPieData.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-muted-foreground">{item.name}</span>
                      <span className="font-bold">{item.value} dk</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">
                Henüz duruş kaydı bulunmuyor
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Cog className="w-5 h-5 text-muted-foreground" />
          Anlık Tezgah Durumları
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {machines.map((machine) => {
            const operator = machine.currentOperatorId
              ? allUsers.find((u) => u.id === machine.currentOperatorId)
              : null;
            const stopReason = machine.currentStopReasonId
              ? stopReasons.find((r) => r.id === machine.currentStopReasonId)
              : null;

            const activeLog = productionLogs.find(
              (l) => l.machineId === machine.id && !l.endTime
            );
            const activeWo = activeLog
              ? workOrders.find((w) => w.id === activeLog.workOrderId)
              : null;
            const activeOp = activeLog
              ? operations.find((o) => o.id === activeLog.operationId)
              : null;

            const statusColor =
              machine.status === "running"
                ? "bg-emerald-500/15 dark:bg-emerald-500/20 border-emerald-500/30"
                : machine.status === "stopped" || machine.status === "broken"
                ? "bg-red-500/15 dark:bg-red-500/20 border-red-500/30"
                : "bg-muted/50 border-border";

            const statusDot =
              machine.status === "running"
                ? "bg-emerald-500"
                : machine.status === "stopped" || machine.status === "broken"
                ? "bg-red-500"
                : "bg-muted-foreground/50";

            const elapsed = machine.statusChangedAt
              ? getElapsedText(new Date(machine.statusChangedAt))
              : "";

            return (
              <Card
                key={machine.id}
                className={`${statusColor} border transition-colors`}
                data-testid={`card-machine-${machine.id}`}
              >
                <CardContent className="p-0 space-y-0">
                  <div className="w-[150px] h-[150px] mx-auto overflow-hidden rounded-t-lg bg-muted/50">
                    {machine.imageUrl ? (
                      <img
                        src={machine.imageUrl}
                        alt={machine.name}
                        className="w-[150px] h-[150px] object-cover"
                        data-testid={`img-dashboard-machine-${machine.id}`}
                      />
                    ) : (
                      <div className="w-[150px] h-[150px] flex items-center justify-center">
                        <ImageIcon className="w-10 h-10 text-muted-foreground/30" />
                      </div>
                    )}
                  </div>
                  <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${statusDot} ${machine.status === "running" ? "animate-pulse" : ""}`} />
                      <span className="font-mono font-bold text-sm">{machine.code}</span>
                    </div>
                    <Badge
                      variant={machine.status === "running" ? "default" : machine.status === "idle" ? "secondary" : "destructive"}
                      className="text-xs"
                    >
                      {STATUS_LABELS[machine.status] || machine.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{machine.name}</p>
                  {machine.description && (
                    <p className="text-xs text-muted-foreground/70 line-clamp-2">{machine.description}</p>
                  )}

                  {operator && (
                    <div className="text-xs space-y-1">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <span>Operator:</span>
                        <span className="font-medium text-foreground">{operator.fullName}</span>
                      </div>
                    </div>
                  )}

                  {(() => {
                    const assigned = operatorAssignments
                      .filter(a => a.machineId === machine.id)
                      .map(a => allUsers.find(u => u.id === a.userId))
                      .filter(Boolean);
                    if (assigned.length === 0) return null;
                    return (
                      <div className="text-xs flex items-center gap-1 text-muted-foreground flex-wrap">
                        <UserCheck className="w-3 h-3 shrink-0" />
                        <span>Atanan:</span>
                        <span className="font-medium text-foreground">
                          {assigned.map(u => u!.fullName).join(", ")}
                        </span>
                      </div>
                    );
                  })()}

                  {activeWo && activeOp && (
                    <div className="text-xs space-y-1 p-2 bg-background/50 rounded-md">
                      <div className="flex items-center gap-1">
                        <Package className="w-3 h-3 text-muted-foreground" />
                        <span className="text-muted-foreground">{activeWo.orderNumber}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Cog className="w-3 h-3 text-muted-foreground" />
                        <span>{activeOp.code} - {activeOp.name}</span>
                      </div>
                    </div>
                  )}

                  {stopReason && (
                    <div className="flex items-center gap-1 text-xs">
                      <Pause className="w-3 h-3 text-destructive" />
                      <span className="text-destructive font-medium">{stopReason.name}</span>
                    </div>
                  )}

                  {elapsed && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      <span>{elapsed}</span>
                    </div>
                  )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <WorkOrderTracker onNavigate={onNavigate} operations={operations} />
    </div>
  );
}

function StatCard({
  label,
  value,
  total,
  icon,
  color,
}: {
  label: string;
  value: number;
  total: number;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <Card data-testid={`stat-${label.replace(/\s/g, "-")}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-1 mb-2">
          <span className={color}>{icon}</span>
          <span className="text-xs text-muted-foreground">{total}</span>
        </div>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground mt-1">{label}</p>
      </CardContent>
    </Card>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-md" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-48 rounded-md" />
        <Skeleton className="h-48 rounded-md" />
      </div>
      <Skeleton className="h-6 w-48" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-40 rounded-md" />
        ))}
      </div>
    </div>
  );
}

function getElapsedText(date: Date): string {
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return `${diff} sn once`;
  if (diff < 3600) return `${Math.floor(diff / 60)} dk once`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} saat once`;
  return `${Math.floor(diff / 86400)} gun once`;
}
