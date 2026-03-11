import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Maximize, AlertTriangle, Activity, Clock,
  User, ChevronLeft, ChevronRight, Pause, Settings2,
  Circle, Play, Wrench,
} from "lucide-react";
import lockcellLogoWhite from "@assets/lockcell-beyaz_1772012570656.webp";

interface TVProduction {
  workOrderNumber: string;
  operationCode: string;
  operationName: string;
  producedQuantity: number;
  targetQuantity: number;
}

interface TVMachine {
  id: number;
  name: string;
  code: string;
  status: "running" | "idle" | "stopped" | "broken";
  imageUrl: string | null;
  description: string | null;
  statusChangedAt: string | null;
  operatorName: string | null;
  stopReasonName: string | null;
  hasActiveProduction: boolean;
  production: TVProduction | null;
}

const STATUS_CONFIG: Record<string, {
  label: string;
  color: string;
  textColor: string;
  bgGradient: string;
  border: string;
  ringColor: string;
  ringTrack: string;
  icon: React.ReactNode;
  glowColor: string;
}> = {
  broken: {
    label: "ARIZALI",
    color: "text-red-400",
    textColor: "#f87171",
    bgGradient: "from-red-950/60 to-red-950/20",
    border: "border-red-500/50",
    ringColor: "#ef4444",
    ringTrack: "#7f1d1d",
    icon: <AlertTriangle className="w-6 h-6" />,
    glowColor: "shadow-red-500/20",
  },
  stopped: {
    label: "DURDU",
    color: "text-amber-400",
    textColor: "#fbbf24",
    bgGradient: "from-amber-950/60 to-amber-950/20",
    border: "border-amber-500/50",
    ringColor: "#f59e0b",
    ringTrack: "#78350f",
    icon: <Pause className="w-6 h-6" />,
    glowColor: "shadow-amber-500/20",
  },
  idle: {
    label: "BOŞTA",
    color: "text-slate-400",
    textColor: "#94a3b8",
    bgGradient: "from-slate-800/60 to-slate-900/40",
    border: "border-slate-600/40",
    ringColor: "#64748b",
    ringTrack: "#1e293b",
    icon: <Circle className="w-6 h-6" />,
    glowColor: "shadow-slate-500/10",
  },
  running: {
    label: "ÜRETİMDE",
    color: "text-emerald-400",
    textColor: "#34d399",
    bgGradient: "from-emerald-950/60 to-emerald-950/20",
    border: "border-emerald-500/50",
    ringColor: "#10b981",
    ringTrack: "#064e3b",
    icon: <Play className="w-6 h-6" />,
    glowColor: "shadow-emerald-500/20",
  },
};

function statusSortOrder(status: string): number {
  if (status === "broken") return 0;
  if (status === "stopped") return 1;
  if (status === "idle") return 2;
  return 3;
}

function formatDuration(from: string | null): string {
  if (!from) return "-";
  const diff = Math.floor((Date.now() - new Date(from).getTime()) / 1000);
  if (diff < 0) return "-";
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  if (h > 0) return `${h}s ${m}dk`;
  return `${m}dk`;
}

function CircularProgress({ percentage, size, strokeWidth, color, trackColor }: {
  percentage: number;
  size: number;
  strokeWidth: number;
  color: string;
  trackColor: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={trackColor}
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-1000 ease-out"
      />
    </svg>
  );
}

const ITEMS_PER_PAGE = 8;
const SLIDE_INTERVAL = 12000;

export default function TVDashboard() {
  const [currentPage, setCurrentPage] = useState(0);
  const [now, setNow] = useState(new Date());
  const slideTimerRef = useRef<NodeJS.Timeout | null>(null);

  const { data: machines = [] } = useQuery<TVMachine[]>({
    queryKey: ["/api/tv-dashboard"],
    refetchInterval: 5000,
  });

  const sorted = [...machines].sort((a, b) => statusSortOrder(a.status) - statusSortOrder(b.status));
  const totalPages = Math.max(1, Math.ceil(sorted.length / ITEMS_PER_PAGE));
  const pageMachines = sorted.slice(currentPage * ITEMS_PER_PAGE, (currentPage + 1) * ITEMS_PER_PAGE);

  const brokenCount = machines.filter(m => m.status === "broken").length;
  const stoppedCount = machines.filter(m => m.status === "stopped").length;
  const runningCount = machines.filter(m => m.status === "running").length;
  const idleCount = machines.filter(m => m.status === "idle").length;

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (totalPages <= 1) return;
    slideTimerRef.current = setInterval(() => {
      setCurrentPage(p => (p + 1) % totalPages);
    }, SLIDE_INTERVAL);
    return () => {
      if (slideTimerRef.current) clearInterval(slideTimerRef.current);
    };
  }, [totalPages]);

  useEffect(() => {
    if (currentPage >= totalPages) setCurrentPage(0);
  }, [totalPages, currentPage]);

  const goFullscreen = () => {
    document.documentElement.requestFullscreen?.().catch(() => {});
  };

  const dateStr = now.toLocaleDateString("tr-TR", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const timeStr = now.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return (
    <div className="fixed inset-0 bg-[#060a14] text-white overflow-hidden flex flex-col" data-testid="tv-dashboard">
      <div className="flex items-center justify-between px-6 py-2.5 bg-[#0c1225] border-b border-blue-900/30">
        <div className="flex items-center gap-4">
          <img src={lockcellLogoWhite} alt="Lockcell" className="h-8 object-contain" data-testid="img-tv-logo" />
          <div className="border-l border-blue-800/40 pl-4">
            <div className="text-[10px] text-blue-300/60 uppercase tracking-[0.2em] font-medium" data-testid="text-tv-date">{dateStr}</div>
            <div className="text-xl font-mono font-bold tabular-nums tracking-wider text-blue-100" data-testid="text-tv-time">{timeStr}</div>
          </div>
        </div>

        <div className="flex items-center gap-5">
          <div className="flex items-center gap-3 text-xs font-medium">
            <div className="flex items-center gap-1.5 bg-slate-800/50 px-3 py-1.5 rounded-full" data-testid="text-tv-total">
              <Settings2 className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-slate-300">Toplam</span>
              <span className="font-bold text-white ml-0.5">{machines.length}</span>
            </div>
            {runningCount > 0 && (
              <div className="flex items-center gap-1.5 bg-emerald-950/50 px-3 py-1.5 rounded-full border border-emerald-800/30" data-testid="text-tv-running">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-emerald-300">Uretimde</span>
                <span className="font-bold text-emerald-200">{runningCount}</span>
              </div>
            )}
            {idleCount > 0 && (
              <div className="flex items-center gap-1.5 bg-slate-800/50 px-3 py-1.5 rounded-full" data-testid="text-tv-idle">
                <div className="w-2 h-2 rounded-full bg-slate-400" />
                <span className="text-slate-400">Bosta</span>
                <span className="font-bold text-slate-300">{idleCount}</span>
              </div>
            )}
            {stoppedCount > 0 && (
              <div className="flex items-center gap-1.5 bg-amber-950/50 px-3 py-1.5 rounded-full border border-amber-800/30" data-testid="text-tv-stopped">
                <div className="w-2 h-2 rounded-full bg-amber-400" />
                <span className="text-amber-300">Durdu</span>
                <span className="font-bold text-amber-200">{stoppedCount}</span>
              </div>
            )}
            {brokenCount > 0 && (
              <div className="flex items-center gap-1.5 bg-red-950/50 px-3 py-1.5 rounded-full border border-red-800/30" data-testid="text-tv-broken">
                <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                <span className="text-red-300">Arizali</span>
                <span className="font-bold text-red-200">{brokenCount}</span>
              </div>
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <button onClick={() => setCurrentPage(p => (p - 1 + totalPages) % totalPages)} className="p-1 hover:text-white transition-colors" data-testid="button-tv-prev">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="font-mono text-blue-300" data-testid="text-tv-page">{currentPage + 1}/{totalPages}</span>
              <button onClick={() => setCurrentPage(p => (p + 1) % totalPages)} className="p-1 hover:text-white transition-colors" data-testid="button-tv-next">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}

          <button onClick={goFullscreen} className="p-2 rounded-lg hover:bg-blue-900/30 transition-colors text-slate-500 hover:text-white" data-testid="button-tv-fullscreen">
            <Maximize className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 p-3">
        <div className="grid grid-cols-4 grid-rows-2 gap-3 h-full">
          {pageMachines.map((machine) => {
            const cfg = STATUS_CONFIG[machine.status] || STATUS_CONFIG.idle;
            const prod = machine.production;
            const pct = prod && prod.targetQuantity > 0
              ? Math.min(100, Math.round((prod.producedQuantity / prod.targetQuantity) * 100))
              : 0;

            return (
              <div
                key={machine.id}
                className={`rounded-2xl border ${cfg.border} bg-gradient-to-br ${cfg.bgGradient} flex flex-col overflow-hidden transition-all duration-500 shadow-lg ${cfg.glowColor} relative`}
                data-testid={`card-tv-machine-${machine.id}`}
              >
                <div className="flex items-center gap-2.5 px-3 pt-3 pb-1">
                  <div className="relative shrink-0">
                    {machine.imageUrl ? (
                      <img
                        src={machine.imageUrl}
                        alt={machine.name}
                        className="w-14 h-14 rounded-xl object-cover border border-white/10"
                        data-testid={`img-tv-machine-${machine.id}`}
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                        <Settings2 className="w-7 h-7 text-slate-600" />
                      </div>
                    )}
                    <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-lg flex items-center justify-center ${cfg.color} border border-black/50`}
                      style={{ backgroundColor: `${cfg.ringColor}30` }}>
                      <div className="scale-[0.55]">{cfg.icon}</div>
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-slate-500 tracking-wide" data-testid={`text-tv-code-${machine.id}`}>{machine.code}</span>
                      <div className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider ${cfg.color}`} data-testid={`text-tv-status-${machine.id}`}>
                        {cfg.label}
                      </div>
                    </div>
                    <div className="font-bold text-base leading-tight truncate text-white" data-testid={`text-tv-name-${machine.id}`}>{machine.name}</div>
                  </div>
                </div>

                {machine.status === "stopped" && machine.stopReasonName && (
                  <div className="px-4 pb-1">
                    <span className="text-[10px] text-amber-400/80 bg-amber-500/10 px-2 py-0.5 rounded-full">
                      {machine.stopReasonName}
                    </span>
                  </div>
                )}

                <div className="flex-1 px-4 py-1.5 flex items-center gap-3 min-h-0">
                  {prod ? (
                    <>
                      <div className="relative shrink-0" data-testid={`progress-ring-${machine.id}`}>
                        <CircularProgress
                          percentage={pct}
                          size={72}
                          strokeWidth={6}
                          color={cfg.ringColor}
                          trackColor={cfg.ringTrack}
                        />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-lg font-bold font-mono" style={{ color: cfg.textColor }}>
                            %{pct}
                          </span>
                        </div>
                      </div>
                      <div className="min-w-0 flex-1 space-y-1" data-testid={`production-info-${machine.id}`}>
                        <div className="text-[11px] font-mono text-blue-300 font-semibold truncate" data-testid={`text-tv-wo-${machine.id}`}>
                          {prod.workOrderNumber}
                        </div>
                        <div className="text-[11px] text-cyan-300/80 font-medium truncate" data-testid={`text-tv-op-${machine.id}`}>
                          {prod.operationCode} - {prod.operationName}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-slate-800/80 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{ width: `${pct}%`, backgroundColor: cfg.ringColor }}
                            />
                          </div>
                          <span className="text-sm font-bold font-mono text-white shrink-0" data-testid={`text-tv-progress-${machine.id}`}>
                            {prod.producedQuantity}/{prod.targetQuantity}
                          </span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex-1 flex items-center justify-center">
                      <span className="text-xs text-slate-600 italic" data-testid={`text-tv-no-production-${machine.id}`}>
                        Aktif iş emri yok
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between px-4 py-1.5 border-t border-white/5 bg-black/10">
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500" data-testid={`text-tv-duration-${machine.id}`}>
                    <Clock className="w-3 h-3" />
                    {formatDuration(machine.statusChangedAt)}
                  </div>
                  {machine.operatorName ? (
                    <div className="flex items-center gap-1.5 text-[11px]" data-testid={`text-tv-operator-${machine.id}`}>
                      <User className="w-3 h-3 text-blue-400" />
                      <span className="text-slate-300 truncate max-w-[120px]">{machine.operatorName}</span>
                    </div>
                  ) : machine.status === "idle" ? (
                    <span className="text-[10px] text-slate-700">Operatorsuz</span>
                  ) : null}
                </div>
              </div>
            );
          })}

          {pageMachines.length < ITEMS_PER_PAGE && Array.from({ length: ITEMS_PER_PAGE - pageMachines.length }).map((_, i) => (
            <div key={`empty-${i}`} className="rounded-2xl border border-blue-900/10 bg-[#0a0e1a]" />
          ))}
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pb-2">
          {Array.from({ length: totalPages }).map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentPage(i)}
              className={`w-2.5 h-2.5 rounded-full transition-all ${i === currentPage ? "bg-blue-500 scale-125 shadow-lg shadow-blue-500/50" : "bg-slate-700 hover:bg-slate-500"}`}
              data-testid={`dot-tv-page-${i}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
