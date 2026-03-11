import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";
import { TrendingUp, TrendingDown, DollarSign, Calculator, ArrowUpRight, ArrowDownRight, AlertTriangle, Pencil, Loader2 } from "lucide-react";
import type { Machine, WorkOrder, WorkOrderLine, ProductionLog, Expense, MonthlyExpense, RecurringExpense, CostAuditLog } from "@shared/schema";

interface ProfitabilityData {
  productionLogs: ProductionLog[];
  stopLogs: any[];
  machines: Machine[];
  workOrders: WorkOrder[];
  expenses: Expense[];
  workOrderLines: WorkOrderLine[];
  monthlyExpenses: MonthlyExpense[];
  recurringExpenses: RecurringExpense[];
}

interface ExchangeRateData {
  rate: number | null;
  source?: string;
  error?: string;
}

function getHoursDiff(start: string | Date | null, end: string | Date | null): number {
  if (!start) return 0;
  const s = new Date(start);
  const e = end ? new Date(end) : new Date();
  return Math.max(0, (e.getTime() - s.getTime()) / (1000 * 60 * 60));
}

function getMonthKey(date: string | Date | null): string {
  if (!date) return "";
  const d = new Date(date);
  const m = d.getMonth() + 1;
  return `${d.getFullYear()}-${m < 10 ? "0" + m : m}`;
}

interface ExecutiveSummary {
  top5Profitable: { orderNumber: string; productName: string; profitMargin: number; profitLoss: number; totalSalePrice: number }[];
  top5ToolCost: { orderNumber: string; productName: string; toolCost: number }[];
  totalEfficiencyLoss: number;
  eurTryRate: number | null;
}

type CostField = "unitPrice" | "materialCostPerUnit" | "toolCostPerUnit";

const fieldLabels: Record<CostField, string> = {
  unitPrice: "Birim Fiyat",
  materialCostPerUnit: "Malzeme Mal./Adet",
  toolCostPerUnit: "Takım Mal./Adet",
};

export default function Profitability() {
  const { toast } = useToast();
  const { data, isLoading } = useQuery<ProfitabilityData>({ queryKey: ["/api/reports/profitability"] });
  const { data: rateData } = useQuery<ExchangeRateData>({ queryKey: ["/api/exchange-rate/eur-try"] });
  const { data: execSummary } = useQuery<ExecutiveSummary>({ queryKey: ["/api/reports/executive-summary"] });

  const [editModal, setEditModal] = useState<{
    workOrderId: number;
    orderNumber: string;
    productName: string;
    field: CostField;
    currentValue: string;
  } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editReason, setEditReason] = useState("");
  const [applyDefault, setApplyDefault] = useState(false);

  const eurTryRate = rateData?.rate || null;

  const toEur = (amount: number, currency: string) => {
    if (currency === "EUR" || !currency) return amount;
    if (currency === "TRY" && eurTryRate && eurTryRate > 0) return amount / eurTryRate;
    return amount;
  };

  const costUpdateMutation = useMutation({
    mutationFn: async () => {
      if (!editModal) return;
      await apiRequest("PATCH", `/api/work-orders/${editModal.workOrderId}/cost`, {
        field: editModal.field,
        value: editValue,
        reason: editReason,
        applyDefault,
      });
    },
    onSuccess: () => {
      const scopeText = applyDefault ? "Varsayılan olarak da kaydedildi" : "Sadece bu iş emrine uygulandı";
      toast({ title: "Maliyet güncellendi", description: scopeText });
      queryClient.invalidateQueries({ queryKey: ["/api/reports/profitability"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reports/executive-summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] });
      setEditModal(null);
      setEditValue("");
      setEditReason("");
      setApplyDefault(false);
    },
    onError: () => {
      toast({ title: "Güncelleme başarısız", variant: "destructive" });
    },
  });

  const openEditModal = (workOrderId: number, orderNumber: string, productName: string, field: CostField, currentValue: number) => {
    setEditModal({ workOrderId, orderNumber, productName, field, currentValue: String(currentValue) });
    setEditValue(String(currentValue));
    setEditReason("");
    setApplyDefault(false);
  };

  const analysis = useMemo(() => {
    if (!data) return [];

    const monthlyExpenseMap: Record<string, number> = {};
    (data.monthlyExpenses || []).forEach((me) => {
      const amountTl = parseFloat(me.amount) || 0;
      const amountEur = toEur(amountTl, "TRY");
      monthlyExpenseMap[me.monthYear] = (monthlyExpenseMap[me.monthYear] || 0) + amountEur;
    });
    data.expenses.forEach((e) => {
      const m = e.month < 10 ? `0${e.month}` : `${e.month}`;
      const key = `${e.year}-${m}`;
      const amountEur = e.amountEur ? parseFloat(e.amountEur) : parseFloat(e.amount);
      monthlyExpenseMap[key] = (monthlyExpenseMap[key] || 0) + amountEur;
    });

    const getNetRunHours = (log: ProductionLog) => {
      const totalHours = getHoursDiff(log.startTime, log.endTime);
      const logStops = data.stopLogs.filter((s: any) => s.productionLogId === log.id);
      let stopHours = 0;
      logStops.forEach((stop: any) => {
        stopHours += getHoursDiff(stop.startTime, stop.endTime);
      });
      return Math.max(0, totalHours - stopHours);
    };

    const monthlyTotalHours: Record<string, number> = {};
    data.productionLogs.forEach((log) => {
      if (!log.startTime) return;
      const key = getMonthKey(log.startTime);
      const netHours = getNetRunHours(log);
      monthlyTotalHours[key] = (monthlyTotalHours[key] || 0) + netHours;
    });

    return data.workOrders.map((wo) => {
      const woLogs = data.productionLogs.filter((l) => l.workOrderId === wo.id);
      const woLines = (data.workOrderLines || []).filter((l) => l.workOrderId === wo.id);

      let directMachineCost = 0;
      let totalWoHours = 0;
      const monthHoursMap: Record<string, number> = {};

      woLogs.forEach((log) => {
        const machine = data.machines.find((m) => m.id === log.machineId);
        const netHours = getNetRunHours(log);
        const hourlyCost = machine ? parseFloat(machine.hourlyCost || "0") : 0;

        directMachineCost += netHours * hourlyCost;
        totalWoHours += netHours;

        if (log.startTime) {
          const mk = getMonthKey(log.startTime);
          monthHoursMap[mk] = (monthHoursMap[mk] || 0) + netHours;
        }
      });

      let overheadCost = 0;
      Object.entries(monthHoursMap).forEach(([mk, woMonthHours]) => {
        const totalMonthExpenses = monthlyExpenseMap[mk] || 0;
        const totalMonthHours = monthlyTotalHours[mk] || 0;
        if (totalMonthHours > 0) {
          const hourlyOverhead = totalMonthExpenses / totalMonthHours;
          overheadCost += hourlyOverhead * woMonthHours;
        }
      });

      let materialCostTotal = 0;
      let toolCostTotal = 0;
      const matPerUnit = woLines[0] ? parseFloat(woLines[0].materialCostPerUnit || "0") : 0;
      const toolPerUnit = woLines[0] ? parseFloat(woLines[0].toolCostPerUnit || "0") : 0;
      woLines.forEach((line) => {
        const matPU = parseFloat(line.materialCostPerUnit || "0");
        const toolPU = parseFloat(line.toolCostPerUnit || "0");
        const currency = line.costCurrency || "EUR";
        const qty = line.completedQuantity > 0 ? line.completedQuantity : line.targetQuantity;
        materialCostTotal += toEur(matPU * qty, currency);
        toolCostTotal += toEur(toolPU * qty, currency);
      });

      if (woLines.length === 0) {
        materialCostTotal = 0;
        toolCostTotal = 0;
      }

      const totalCost = directMachineCost + overheadCost + materialCostTotal + toolCostTotal;
      const unitPrice = parseFloat(wo.targetPrice || "0");
      const totalSalePrice = unitPrice * wo.targetQuantity;
      const profitLoss = totalSalePrice - totalCost;
      const profitMargin = totalSalePrice > 0 ? (profitLoss / totalSalePrice) * 100 : 0;

      let efficiencyLossCost = 0;
      if (wo.targetQuantity > 0 && totalWoHours > 0) {
        const completedQty = wo.completedQuantity || 0;
        if (completedQty > 0) {
          const actualHoursPerUnit = totalWoHours / completedQty;
          const targetHoursPerUnit = totalWoHours / wo.targetQuantity;
          if (actualHoursPerUnit > targetHoursPerUnit) {
            const hourlyMachineCost = directMachineCost / totalWoHours;
            const hourlyOverhead = overheadCost / totalWoHours;
            const excessHours = (actualHoursPerUnit - targetHoursPerUnit) * completedQty;
            efficiencyLossCost = excessHours * (hourlyMachineCost + hourlyOverhead);
          }
        }
      }

      return {
        workOrder: wo,
        unitPrice,
        matPerUnit,
        toolPerUnit,
        totalSalePrice: Math.round(totalSalePrice * 100) / 100,
        materialCost: Math.round(materialCostTotal * 100) / 100,
        toolCost: Math.round(toolCostTotal * 100) / 100,
        directMachineCost: Math.round(directMachineCost * 100) / 100,
        overheadCost: Math.round(overheadCost * 100) / 100,
        totalCost: Math.round(totalCost * 100) / 100,
        profitLoss: Math.round(profitLoss * 100) / 100,
        profitMargin: Math.round(profitMargin * 10) / 10,
        totalHours: Math.round(totalWoHours * 100) / 100,
        efficiencyLossCost: Math.round(efficiencyLossCost * 100) / 100,
      };
    });
  }, [data, eurTryRate]);

  const totalRevenue = analysis.reduce((s, a) => s + a.totalSalePrice, 0);
  const totalCostAll = analysis.reduce((s, a) => s + a.totalCost, 0);
  const totalProfit = analysis.reduce((s, a) => s + a.profitLoss, 0);
  const totalEfficiencyLoss = analysis.reduce((s, a) => s + a.efficiencyLossCost, 0);

  const chartData = analysis
    .filter((a) => a.totalSalePrice > 0 || a.totalCost > 0)
    .map((a) => ({
      name: a.workOrder.orderNumber,
      gelir: a.totalSalePrice,
      maliyet: a.totalCost,
      kar: a.profitLoss,
    }));

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2" data-testid="text-profitability-title">
          <Calculator className="w-5 h-5 text-muted-foreground" />
          İş Emri Kârlılık Analizi
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Malzeme + Takım + Makine Maliyeti + Genel Gider Payı + Verimlilik Kaybı ile Kârlılık Hesaplaması
          {eurTryRate && (
            <span className="ml-2 text-xs text-blue-500">(EUR/TRY: {eurTryRate.toFixed(2)})</span>
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="bg-blue-500/5 border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <DollarSign className="w-3.5 h-3.5" />
              Toplam Gelir
            </div>
            <p className="text-2xl font-bold" data-testid="text-total-revenue">
              {totalRevenue.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} EUR
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Calculator className="w-3.5 h-3.5" />
              Toplam Maliyet
            </div>
            <p className="text-2xl font-bold" data-testid="text-total-cost-all">
              {totalCostAll.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} EUR
            </p>
          </CardContent>
        </Card>
        <Card className={totalProfit >= 0 ? "bg-green-500/5 border-green-500/20" : "bg-red-500/5 border-red-500/20"}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              {totalProfit >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              Toplam Kâr/Zarar
            </div>
            <p className={`text-2xl font-bold ${totalProfit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`} data-testid="text-total-profit">
              {totalProfit >= 0 ? "+" : ""}{totalProfit.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} EUR
            </p>
          </CardContent>
        </Card>
        <Card className={totalEfficiencyLoss > 0 ? "bg-red-500/5 border-red-500/20" : "bg-muted/5"}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <TrendingDown className="w-3.5 h-3.5" />
              Verimlilik Kaybı Maliyeti
            </div>
            <p className={`text-2xl font-bold ${totalEfficiencyLoss > 0 ? "text-red-600 dark:text-red-400" : ""}`} data-testid="text-total-efficiency-loss">
              {totalEfficiencyLoss > 0 ? "-" : ""}{totalEfficiencyLoss.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} EUR
            </p>
          </CardContent>
        </Card>
      </div>

      {execSummary && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card data-testid="card-top5-profitable">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                En Kârlı 5 İş Emri
              </h3>
              {execSummary.top5Profitable.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={execSummary.top5Profitable} layout="vertical" margin={{ left: 10, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `%${v}`} />
                    <YAxis type="category" dataKey="orderNumber" tick={{ fontSize: 10 }} width={90} />
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px", color: "hsl(var(--foreground))" }}
                      formatter={(value: number, name: string) => [
                        name === "profitMargin" ? `%${value}` : `${value.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} EUR`,
                        name === "profitMargin" ? "Kâr Marjı" : "Net Kâr",
                      ]}
                    />
                    <Bar dataKey="profitMargin" fill="#10b981" name="profitMargin" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">Veri bulunamadı</div>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-top5-toolcost">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-purple-500" />
                Takım Maliyeti Alarmı (Top 5)
              </h3>
              {execSummary.top5ToolCost.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={execSummary.top5ToolCost} layout="vertical" margin={{ left: 10, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="orderNumber" tick={{ fontSize: 10 }} width={90} />
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px", color: "hsl(var(--foreground))" }}
                      formatter={(value: number) => [`${value.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} EUR`, "Takım Maliyeti"]}
                    />
                    <Bar dataKey="toolCost" fill="#8b5cf6" name="toolCost" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">Veri bulunamadı</div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {chartData.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold mb-4">İş Emri Bazında Gelir / Maliyet</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    color: "hsl(var(--foreground))",
                  }}
                  formatter={(value: number, name: string) => [
                    `${value.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} EUR`,
                    name === "gelir" ? "Gelir" : name === "maliyet" ? "Maliyet" : "Kâr/Zarar",
                  ]}
                />
                <Bar dataKey="gelir" fill="hsl(var(--chart-2))" name="Gelir" radius={[4, 4, 0, 0]} />
                <Bar dataKey="maliyet" fill="hsl(var(--chart-1))" name="Maliyet" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        <h3 className="font-semibold">Detaylı Kârlılık Tablosu</h3>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left p-3 font-medium text-muted-foreground">İş Emri</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Ürün</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Birim Fiyat</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Toplam Satış</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Malzeme Mal.</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Takım Mal.</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Makine Mal.</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Genel Gider</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Toplam Mal.</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Verim. Kaybı</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Kâr/Zarar</th>
                <th className="text-center p-3 font-medium text-muted-foreground">Marj</th>
              </tr>
            </thead>
            <tbody>
              {analysis.map((a) => (
                <tr key={a.workOrder.id} className="border-b border-border/30 hover:bg-muted/30" data-testid={`row-profitability-${a.workOrder.id}`}>
                  <td className="p-3 font-mono font-medium">{a.workOrder.orderNumber}</td>
                  <td className="p-3 text-muted-foreground">{a.workOrder.productName}</td>
                  <td className="p-3 text-right">
                    <button
                      className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer group"
                      onClick={() => openEditModal(a.workOrder.id, a.workOrder.orderNumber, a.workOrder.productName, "unitPrice", a.unitPrice)}
                      data-testid={`button-edit-unitprice-${a.workOrder.id}`}
                    >
                      {a.unitPrice.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} EUR
                      <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  </td>
                  <td className="p-3 text-right font-medium">{a.totalSalePrice.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} EUR</td>
                  <td className="p-3 text-right">
                    <button
                      className="inline-flex items-center gap-1 text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 transition-colors cursor-pointer group"
                      onClick={() => openEditModal(a.workOrder.id, a.workOrder.orderNumber, a.workOrder.productName, "materialCostPerUnit", a.matPerUnit)}
                      data-testid={`button-edit-material-${a.workOrder.id}`}
                    >
                      {a.materialCost.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} EUR
                      <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  </td>
                  <td className="p-3 text-right">
                    <button
                      className="inline-flex items-center gap-1 text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors cursor-pointer group"
                      onClick={() => openEditModal(a.workOrder.id, a.workOrder.orderNumber, a.workOrder.productName, "toolCostPerUnit", a.toolPerUnit)}
                      data-testid={`button-edit-tool-${a.workOrder.id}`}
                    >
                      {a.toolCost.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} EUR
                      <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  </td>
                  <td className="p-3 text-right">{a.directMachineCost.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} EUR</td>
                  <td className="p-3 text-right">{a.overheadCost.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} EUR</td>
                  <td className="p-3 text-right font-medium">{a.totalCost.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} EUR</td>
                  <td className={`p-3 text-right ${a.efficiencyLossCost > 0 ? "text-red-600 dark:text-red-400 font-medium" : "text-muted-foreground"}`}>
                    {a.efficiencyLossCost > 0 ? "-" : ""}{a.efficiencyLossCost.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} EUR
                  </td>
                  <td className={`p-3 text-right font-bold ${a.profitLoss >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                    <span className="flex items-center justify-end gap-1">
                      {a.profitLoss >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                      {a.profitLoss >= 0 ? "+" : ""}{a.profitLoss.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} EUR
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <Badge
                      variant={a.profitMargin >= 10 ? "default" : a.profitMargin >= 0 ? "secondary" : "destructive"}
                      className="text-xs"
                    >
                      %{a.profitMargin}
                    </Badge>
                  </td>
                </tr>
              ))}
              {analysis.length === 0 && (
                <tr>
                  <td colSpan={12} className="p-8 text-center text-muted-foreground">
                    Henüz iş emri verisi bulunamadı.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!editModal} onOpenChange={(open) => { if (!open) { setEditModal(null); setEditValue(""); setEditReason(""); setApplyDefault(false); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5" />
              {editModal ? fieldLabels[editModal.field] : ""} Güncelle
            </DialogTitle>
            <DialogDescription>
              {editModal?.orderNumber} - {editModal?.productName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
                {editModal ? fieldLabels[editModal.field] : ""} (EUR)
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="h-12 text-lg font-mono"
                data-testid="input-cost-value"
                autoFocus
              />
              <p className="text-xs text-muted-foreground mt-1">
                Mevcut deger: {parseFloat(editModal?.currentValue || "0").toLocaleString("tr-TR", { minimumFractionDigits: 2 })} EUR
              </p>
            </div>

            <div className="rounded-lg border border-border/50 p-4 space-y-3 bg-muted/20">
              <p className="text-sm font-medium">Kapsam Secimi</p>
              <label className="flex items-start gap-3 cursor-pointer" data-testid="radio-only-this">
                <input
                  type="radio"
                  name="scope"
                  checked={!applyDefault}
                  onChange={() => setApplyDefault(false)}
                  className="mt-1"
                />
                <div>
                  <p className="text-sm font-medium">Sadece bu iş emri</p>
                  <p className="text-xs text-muted-foreground">Değişiklik yalnızca bu iş emrine uygulanır.</p>
                </div>
              </label>
              <label className="flex items-start gap-3 cursor-pointer" data-testid="radio-apply-default">
                <input
                  type="radio"
                  name="scope"
                  checked={applyDefault}
                  onChange={() => setApplyDefault(true)}
                  className="mt-1"
                />
                <div>
                  <p className="text-sm font-medium">Varsayılan olarak da kaydet</p>
                  <p className="text-xs text-muted-foreground">Bu ürünün gelecekteki tüm üretimleri için varsayılan maliyet olarak kaydedilir.</p>
                </div>
              </label>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
                Değişiklik Nedeni *
              </label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[72px] resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                placeholder="Değişiklik nedenini giriniz (zorunlu)"
                data-testid="input-cost-reason"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="secondary" onClick={() => { setEditModal(null); setEditValue(""); setEditReason(""); setApplyDefault(false); }}>
              İptal
            </Button>
            <Button
              onClick={() => costUpdateMutation.mutate()}
              disabled={costUpdateMutation.isPending || !editValue || editValue === editModal?.currentValue || isNaN(parseFloat(editValue)) || parseFloat(editValue) < 0 || !editReason.trim()}
              data-testid="button-confirm-cost-update"
            >
              {costUpdateMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Kaydediliyor...
                </>
              ) : (
                "Kaydet"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
