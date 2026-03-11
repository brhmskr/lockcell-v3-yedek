import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileSpreadsheet, Clock, Pause, Package, Wrench,
  User as UserIcon, Calendar, DollarSign, ChevronLeft,
  ChevronRight, Download, X, Search,
} from "lucide-react";
import * as XLSX from "xlsx";
import type { Machine, WorkOrder, Operation, ProductionLog, User, StopReason, StopLog, WorkOrderLine, OperatorAssignment } from "@shared/schema";

interface ReportData {
  productionLogs: ProductionLog[];
  stopLogs: StopLog[];
  machines: Machine[];
  workOrders: WorkOrder[];
  operations: Operation[];
  users: Omit<User, "password">[];
  stopReasons: StopReason[];
  workOrderLines: WorkOrderLine[];
  operatorAssignments: OperatorAssignment[];
}

interface ReportRow {
  logId: number;
  machineName: string;
  machineCode: string;
  orderNumber: string;
  operationCode: string;
  operationName: string;
  operatorName: string;
  startTime: Date;
  endTime: Date | null;
  netWorkingMs: number;
  totalDowntimeMs: number;
  producedQuantity: number;
  status: string;
  partCode: string;
  unitPrice: string;
  totalPrice: string;
  assignedOperator: string;
}

function calcDurations(log: ProductionLog, logStopLogs: StopLog[]): { netWorkingMs: number; totalDowntimeMs: number } {
  const now = new Date();
  const start = new Date(log.startTime!);
  const end = log.endTime ? new Date(log.endTime) : now;
  const totalElapsed = end.getTime() - start.getTime();
  let totalDowntimeMs = 0;
  for (const sl of logStopLogs) {
    const slStart = new Date(sl.startTime!);
    const slEnd = sl.endTime ? new Date(sl.endTime) : now;
    totalDowntimeMs += slEnd.getTime() - slStart.getTime();
  }
  return { netWorkingMs: Math.max(0, totalElapsed - totalDowntimeMs), totalDowntimeMs };
}

function formatDuration(ms: number): string {
  if (ms <= 0) return "0dk";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}sa ${minutes}dk ${seconds}sn`;
  if (minutes > 0) return `${minutes}dk ${seconds}sn`;
  return `${seconds}sn`;
}

function formatDateTime(date: Date): string {
  return new Date(date).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function buildRows(data: ReportData): ReportRow[] {
  return data.productionLogs
    .map((log) => {
      const machine = data.machines.find((m) => m.id === log.machineId);
      const wo = data.workOrders.find((w) => w.id === log.workOrderId);
      const op = data.operations.find((o) => o.id === log.operationId);
      const user = data.users.find((u) => u.id === log.userId);
      const logStopLogs = data.stopLogs.filter((sl) => sl.productionLogId === log.id);
      const { netWorkingMs, totalDowntimeMs } = calcDurations(log, logStopLogs);
      const woLine = log.workOrderLineId ? data.workOrderLines.find((l) => l.id === log.workOrderLineId) : undefined;
      const partCode = woLine ? woLine.productCode : "-";
      const unitPrice = woLine?.targetPricePerUnit || "0";
      const totalPrice = ((parseFloat(unitPrice) || 0) * (log.producedQuantity || 0)).toFixed(2);
      const assignedOps = data.operatorAssignments
        .filter((a) => a.machineId === log.machineId)
        .map((a) => data.users.find((usr) => usr.id === a.userId)?.fullName || "")
        .filter(Boolean);
      return {
        logId: log.id, machineName: machine?.name || "-", machineCode: machine?.code || "-",
        orderNumber: wo?.orderNumber || "-", operationCode: op?.code || "-", operationName: op?.name || "-",
        operatorName: user?.fullName || "-", startTime: new Date(log.startTime!),
        endTime: log.endTime ? new Date(log.endTime) : null, netWorkingMs, totalDowntimeMs,
        producedQuantity: log.producedQuantity, status: log.status, partCode, unitPrice, totalPrice,
        assignedOperator: assignedOps.length > 0 ? assignedOps.join(", ") : "-",
      };
    })
    .sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
}

function exportExcel(rows: ReportRow[]) {
  const headers = [
    "Tezgah", "Tezgah Kodu", "İş Emri", "Operasyon Kodu", "Operasyon Adı",
    "Operatör", "Başlangıç", "Bitiş", "Net Çalışma", "Toplam Duruş",
    "Üretilen Adet", "Parça Kodu", "Birim Fiyat (€)", "Toplam Fiyat (€)",
    "Atanan Operatör", "Durum",
  ];
  const dataRows = rows.map((r) => [
    r.machineName, r.machineCode, r.orderNumber, r.operationCode, r.operationName,
    r.operatorName, formatDateTime(r.startTime),
    r.endTime ? formatDateTime(r.endTime) : "Devam Ediyor",
    formatDuration(r.netWorkingMs), formatDuration(r.totalDowntimeMs),
    r.producedQuantity, r.partCode,
    parseFloat(r.unitPrice) || 0, parseFloat(r.totalPrice) || 0,
    r.assignedOperator,
    r.status === "completed" ? "Tamamlandı" : r.status === "running" ? "Çalışıyor" : "Duraklatıldı",
  ]);
  const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
  ws["!cols"] = headers.map(() => ({ wch: 18 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Üretim Raporu");
  XLSX.writeFile(wb, `uretim-raporu-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

const STATUS_LABELS: Record<string, string> = { completed: "Tamamlandı", running: "Çalışıyor", paused: "Duraklatıldı" };
const PAGE_SIZE = 25;

interface ColFilters {
  machine: string;
  order: string;
  operator: string;
  partCode: string;
  date: string;
  status: string;
}

function matches(value: string, filter: string): boolean {
  return !filter || value.toLowerCase().includes(filter.toLowerCase());
}

export default function Reports() {
  const { data, isLoading } = useQuery<ReportData>({ queryKey: ["/api/reports/production"] });

  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<ColFilters>({ machine: "", order: "", operator: "", partCode: "", date: "", status: "" });

  const setFilter = (key: keyof ColFilters, val: string) => {
    setFilters((prev) => ({ ...prev, [key]: val }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters({ machine: "", order: "", operator: "", partCode: "", date: "", status: "" });
    setPage(1);
  };

  const hasFilters = Object.values(filters).some(Boolean);

  const allRows = useMemo(() => (data ? buildRows(data) : []), [data]);

  const filteredRows = useMemo(() => {
    return allRows.filter((r) => {
      const machineStr = `${r.machineCode} ${r.machineName}`;
      const orderStr = `${r.orderNumber} ${r.operationCode} ${r.operationName}`;
      const statusLabel = STATUS_LABELS[r.status] || r.status;
      const dateStr = formatDateTime(r.startTime);
      return (
        matches(machineStr, filters.machine) &&
        matches(orderStr, filters.order) &&
        matches(r.operatorName, filters.operator) &&
        matches(r.partCode, filters.partCode) &&
        matches(dateStr, filters.date) &&
        matches(statusLabel, filters.status)
      );
    });
  }, [allRows, filters]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedRows = filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const totalNetWork = filteredRows.reduce((s, r) => s + r.netWorkingMs, 0);
  const totalDowntime = filteredRows.reduce((s, r) => s + r.totalDowntimeMs, 0);
  const totalProduced = filteredRows.filter((r) => r.status === "completed").reduce((s, r) => s + r.producedQuantity, 0);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!data) return null;

  const pageNumbers: number[] = [];
  const start = Math.max(1, safePage - 2);
  const end = Math.min(totalPages, start + 4);
  for (let i = start; i <= end; i++) pageNumbers.push(i);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2" data-testid="text-reports-title">
            <FileSpreadsheet className="w-5 h-5 text-muted-foreground" />
            Detayli Uretim Raporu
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {hasFilters
              ? `${filteredRows.length} / ${allRows.length} kayit gosteriliyor`
              : `${allRows.length} uretim kaydi`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {hasFilters && (
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={clearFilters} data-testid="button-clear-report-filters">
              <X className="w-3.5 h-3.5" /> Filtreleri Temizle
            </Button>
          )}
          <Button onClick={() => exportExcel(filteredRows)} variant="outline" className="gap-2" disabled={filteredRows.length === 0} data-testid="button-export-excel">
            <Download className="w-4 h-4" />
            Excel Olarak Indir
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="w-8 h-8 text-chart-2 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Toplam Net Calisma</p>
              <p className="text-lg font-bold" data-testid="text-total-net-work">{formatDuration(totalNetWork)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Pause className="w-8 h-8 text-destructive shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Toplam Durus Suresi</p>
              <p className="text-lg font-bold" data-testid="text-total-downtime">{formatDuration(totalDowntime)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Package className="w-8 h-8 text-chart-4 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Toplam Uretilen Adet</p>
              <p className="text-lg font-bold" data-testid="text-total-produced">{totalProduced}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto" style={{ maxHeight: "70vh", overflowY: "auto" }}>
            <table className="w-full text-sm border-collapse" data-testid="table-production-report">
              <thead className="sticky top-0 z-20">
                <tr className="border-b bg-muted/90 backdrop-blur-sm">
                  <th className="text-left p-3 font-semibold text-muted-foreground whitespace-nowrap">
                    <div className="flex items-center gap-1"><Wrench className="w-3.5 h-3.5" /> Tezgah</div>
                  </th>
                  <th className="text-left p-3 font-semibold text-muted-foreground whitespace-nowrap">
                    <div className="flex items-center gap-1"><Package className="w-3.5 h-3.5" /> Is Emri / Operasyon</div>
                  </th>
                  <th className="text-left p-3 font-semibold text-muted-foreground whitespace-nowrap">
                    <div className="flex items-center gap-1"><UserIcon className="w-3.5 h-3.5" /> Operator</div>
                  </th>
                  <th className="text-right p-3 font-semibold text-muted-foreground whitespace-nowrap">
                    <div className="flex items-center gap-1 justify-end"><Clock className="w-3.5 h-3.5" /> Net Calisma</div>
                  </th>
                  <th className="text-right p-3 font-semibold text-muted-foreground whitespace-nowrap">
                    <div className="flex items-center gap-1 justify-end"><Pause className="w-3.5 h-3.5" /> Durus</div>
                  </th>
                  <th className="text-right p-3 font-semibold text-muted-foreground whitespace-nowrap">
                    <div className="flex items-center gap-1 justify-end"><Package className="w-3.5 h-3.5" /> Islenen Adet</div>
                  </th>
                  <th className="text-left p-3 font-semibold text-muted-foreground whitespace-nowrap">
                    <div className="flex items-center gap-1"><Package className="w-3.5 h-3.5" /> Parca Kodu</div>
                  </th>
                  <th className="text-right p-3 font-semibold text-muted-foreground whitespace-nowrap">
                    <div className="flex items-center gap-1 justify-end"><DollarSign className="w-3.5 h-3.5" /> Birim Fiyat</div>
                  </th>
                  <th className="text-right p-3 font-semibold text-muted-foreground whitespace-nowrap">
                    <div className="flex items-center gap-1 justify-end"><DollarSign className="w-3.5 h-3.5" /> Toplam Fiyat</div>
                  </th>
                  <th className="text-left p-3 font-semibold text-muted-foreground whitespace-nowrap">
                    <div className="flex items-center gap-1"><UserIcon className="w-3.5 h-3.5" /> Atanan Operator</div>
                  </th>
                  <th className="text-left p-3 font-semibold text-muted-foreground whitespace-nowrap">
                    <div className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Tarih</div>
                  </th>
                  <th className="text-center p-3 font-semibold text-muted-foreground whitespace-nowrap">Durum</th>
                </tr>
                <tr className="border-b bg-muted/70 backdrop-blur-sm">
                  <td className="px-2 py-1.5">
                    <div className="relative">
                      <Search className="absolute left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                      <Input value={filters.machine} onChange={(e) => setFilter("machine", e.target.value)} placeholder="Tezgah ara..." className="h-6 pl-6 text-[11px]" data-testid="filter-machine" />
                    </div>
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="relative">
                      <Search className="absolute left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                      <Input value={filters.order} onChange={(e) => setFilter("order", e.target.value)} placeholder="Is emri ara..." className="h-6 pl-6 text-[11px]" data-testid="filter-order" />
                    </div>
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="relative">
                      <Search className="absolute left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                      <Input value={filters.operator} onChange={(e) => setFilter("operator", e.target.value)} placeholder="Operator ara..." className="h-6 pl-6 text-[11px]" data-testid="filter-operator" />
                    </div>
                  </td>
                  <td className="px-2 py-1.5" />
                  <td className="px-2 py-1.5" />
                  <td className="px-2 py-1.5" />
                  <td className="px-2 py-1.5">
                    <div className="relative">
                      <Search className="absolute left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                      <Input value={filters.partCode} onChange={(e) => setFilter("partCode", e.target.value)} placeholder="Parca kodu..." className="h-6 pl-6 text-[11px]" data-testid="filter-part-code" />
                    </div>
                  </td>
                  <td className="px-2 py-1.5" />
                  <td className="px-2 py-1.5" />
                  <td className="px-2 py-1.5" />
                  <td className="px-2 py-1.5">
                    <div className="relative">
                      <Search className="absolute left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                      <Input value={filters.date} onChange={(e) => setFilter("date", e.target.value)} placeholder="Tarih ara..." className="h-6 pl-6 text-[11px]" data-testid="filter-date" />
                    </div>
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="relative">
                      <Search className="absolute left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                      <Input value={filters.status} onChange={(e) => setFilter("status", e.target.value)} placeholder="Durum..." className="h-6 pl-6 text-[11px]" data-testid="filter-status" />
                    </div>
                  </td>
                </tr>
              </thead>
              <tbody>
                {pagedRows.map((row) => (
                  <tr key={row.logId} className="border-b border-border/30 hover:bg-muted/20 transition-colors" data-testid={`row-report-${row.logId}`}>
                    <td className="p-3">
                      <div className="font-mono font-semibold text-xs">{row.machineCode}</div>
                      <div className="text-xs text-muted-foreground">{row.machineName}</div>
                    </td>
                    <td className="p-3">
                      <div className="font-mono text-xs">{row.orderNumber}</div>
                      <div className="text-xs text-muted-foreground">{row.operationCode} - {row.operationName}</div>
                    </td>
                    <td className="p-3 text-xs">{row.operatorName}</td>
                    <td className="p-3 text-right font-mono text-xs text-chart-2">{formatDuration(row.netWorkingMs)}</td>
                    <td className="p-3 text-right font-mono text-xs text-destructive">
                      {row.totalDowntimeMs > 0 ? formatDuration(row.totalDowntimeMs) : "-"}
                    </td>
                    <td className="p-3 text-right font-mono text-xs font-semibold">{row.producedQuantity}</td>
                    <td className="p-3 text-left text-xs">{row.partCode}</td>
                    <td className="p-3 text-right font-mono text-xs">{row.unitPrice} €</td>
                    <td className="p-3 text-right font-mono text-xs">{row.totalPrice} €</td>
                    <td className="p-3 text-left text-xs">{row.assignedOperator}</td>
                    <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(row.startTime)}</td>
                    <td className="p-3 text-center">
                      <Badge
                        variant={row.status === "completed" ? "default" : row.status === "running" ? "secondary" : "destructive"}
                        className="text-xs"
                        data-testid={`badge-status-${row.logId}`}
                      >
                        {STATUS_LABELS[row.status] || row.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
                {filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={12} className="p-10 text-center text-muted-foreground">
                      {hasFilters ? "Filtrelerle esleen kayit bulunamadi." : "Henuz uretim kaydi bulunmuyor."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-1" data-testid="section-report-pagination">
          <p className="text-xs text-muted-foreground">
            {filteredRows.length} kayitten {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filteredRows.length)} arasi gosteriliyor (Sayfa {safePage} / {totalPages})
          </p>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => setPage(1)} disabled={safePage <= 1} data-testid="button-report-first-page">
              <ChevronLeft className="w-3 h-3" /><ChevronLeft className="w-3 h-3 -ml-2" />
            </Button>
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1} data-testid="button-report-prev-page">
              <ChevronLeft className="w-3.5 h-3.5" /> Onceki
            </Button>
            {pageNumbers.map((pg) => (
              <Button key={pg} variant={safePage === pg ? "default" : "outline"} size="sm" className="h-7 w-7 p-0 text-xs" onClick={() => setPage(pg)} data-testid={`button-report-page-${pg}`}>
                {pg}
              </Button>
            ))}
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages} data-testid="button-report-next-page">
              Sonraki <ChevronRight className="w-3.5 h-3.5" />
            </Button>
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => setPage(totalPages)} disabled={safePage >= totalPages} data-testid="button-report-last-page">
              <ChevronRight className="w-3 h-3" /><ChevronRight className="w-3 h-3 -ml-2" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
