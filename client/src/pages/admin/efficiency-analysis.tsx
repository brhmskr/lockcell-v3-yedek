import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp, Clock, AlertTriangle, BarChart3,
  Timer, ArrowRight, Loader2, Printer, ChevronsUpDown, CheckIcon,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from "recharts";
import type { WorkOrder, Operation, Machine, WorkOrderOperation } from "@shared/schema";
import { cn } from "@/lib/utils";

export default function EfficiencyAnalysis() {
  const [selectedWoId, setSelectedWoId] = useState("");
  const [woComboOpen, setWoComboOpen] = useState(false);

  const handlePrint = () => window.print();

  const { data: workOrders = [] } = useQuery<WorkOrder[]>({ queryKey: ["/api/work-orders"] });
  const { data: operations = [] } = useQuery<Operation[]>({ queryKey: ["/api/operations"] });
  const { data: machines = [] } = useQuery<Machine[]>({ queryKey: ["/api/machines"] });
  const { data: productionLogs = [] } = useQuery<any[]>({ queryKey: ["/api/production-logs"] });

  const { data: woOps = [], isLoading: opsLoading } = useQuery<WorkOrderOperation[]>({
    queryKey: ["/api/work-order-operations", selectedWoId],
    queryFn: () => selectedWoId ? fetch(`/api/work-order-operations/${selectedWoId}`, { credentials: "include" }).then(r => r.json()) : Promise.resolve([]),
    enabled: !!selectedWoId,
  });

  const allWoIds = workOrders.map(wo => wo.id);
  const { data: allOpsData = {} } = useQuery<Record<string, WorkOrderOperation[]>>({
    queryKey: ["/api/work-order-operations/all", allWoIds.join(",")],
    queryFn: async () => {
      const result: Record<string, WorkOrderOperation[]> = {};
      for (const wo of workOrders) {
        const ops = await fetch(`/api/work-order-operations/${wo.id}`, { credentials: "include" }).then(r => r.json());
        result[wo.id] = ops;
      }
      return result;
    },
    enabled: workOrders.length > 0,
  });

  const getOp = (id: number) => operations.find(o => o.id === id);
  const getMachine = (id: number | null) => id ? machines.find(m => m.id === id) : null;

  const getActualMinutes = (woOp: WorkOrderOperation) => {
    if (!woOp.actualStartDate || !woOp.actualEndDate) return null;
    return Math.round((new Date(woOp.actualEndDate).getTime() - new Date(woOp.actualStartDate).getTime()) / 60000);
  };

  const completedOps = woOps.filter(op => op.status === "completed" && op.actualStartDate && op.actualEndDate);

  const woProductionLogs = selectedWoId
    ? productionLogs.filter((l: any) => l.workOrderId === Number(selectedWoId) && l.status === "completed" && l.startTime && l.endTime)
    : [];

  const useLogsFallback = completedOps.length === 0 && woProductionLogs.length > 0;

  const timeComparisonData = useLogsFallback
    ? woProductionLogs.map((log: any) => {
        const op = getOp(log.operationId);
        const actual = Math.round((new Date(log.endTime).getTime() - new Date(log.startTime).getTime()) / 60000);
        return {
          name: op?.code || "?",
          planlanan: 0,
          gerceklesen: actual,
          fark: actual,
          farkYuzde: "0",
        };
      })
    : completedOps.map(woOp => {
        const op = getOp(woOp.operationId);
        const actual = getActualMinutes(woOp) || 0;
        const planned = woOp.plannedDurationMinutes || 0;
        return {
          name: op?.code || "?",
          planlanan: planned,
          gerceklesen: actual,
          fark: actual - planned,
          farkYuzde: planned > 0 ? (((actual - planned) / planned) * 100).toFixed(1) : "0",
        };
      });

  const bottleneckSource = useLogsFallback
    ? woProductionLogs.map((log: any) => ({
        operationId: log.operationId,
        actualStartDate: log.startTime,
        actualEndDate: log.endTime,
      }))
    : completedOps;

  const bottleneckData = bottleneckSource.slice(0, -1).map((woOp: any, idx: number) => {
    const nextOp = bottleneckSource[idx + 1];
    const op = getOp(woOp.operationId);
    const nextOpDef = getOp(nextOp.operationId);
    if (!woOp.actualEndDate || !nextOp.actualStartDate) return null;
    const waitMinutes = Math.round((new Date(nextOp.actualStartDate).getTime() - new Date(woOp.actualEndDate).getTime()) / 60000);
    return {
      name: `${op?.code || "?"} -> ${nextOpDef?.code || "?"}`,
      bekleme: Math.max(0, waitMinutes),
      fromOp: op?.code,
      toOp: nextOpDef?.code,
    };
  }).filter(Boolean).sort((a: any, b: any) => b.bekleme - a.bekleme);

  const allCompletedOps: (WorkOrderOperation & { woNumber?: string })[] = [];
  for (const [woId, ops] of Object.entries(allOpsData)) {
    const wo = workOrders.find(w => w.id === Number(woId));
    for (const op of (ops as WorkOrderOperation[])) {
      if (op.producedQuantity > 0) {
        allCompletedOps.push({ ...op, woNumber: wo?.orderNumber });
      }
    }
  }

  const scrapByOperation: Record<string, { produced: number; accepted: number; scrap: number }> = {};
  if (allCompletedOps.length > 0) {
    for (const op of allCompletedOps) {
      const opDef = getOp(op.operationId);
      const key = opDef?.code || String(op.operationId);
      if (!scrapByOperation[key]) scrapByOperation[key] = { produced: 0, accepted: 0, scrap: 0 };
      scrapByOperation[key].produced += op.producedQuantity;
      scrapByOperation[key].accepted += op.acceptedQuantity;
      scrapByOperation[key].scrap += (op.producedQuantity - op.acceptedQuantity);
    }
  } else {
    const completedLogs = productionLogs.filter((l: any) => l.status === "completed" && (l.producedQuantity || 0) > 0);
    for (const log of completedLogs) {
      const opDef = getOp(log.operationId);
      const key = opDef?.code || String(log.operationId);
      if (!scrapByOperation[key]) scrapByOperation[key] = { produced: 0, accepted: 0, scrap: 0 };
      scrapByOperation[key].produced += log.producedQuantity || 0;
      scrapByOperation[key].accepted += log.producedQuantity || 0;
    }
  }

  const scrapData = Object.entries(scrapByOperation)
    .filter(([_, v]) => v.produced > 0)
    .map(([code, v]) => ({
      name: code,
      fireOrani: Number(((v.scrap / v.produced) * 100).toFixed(1)),
      fire: v.scrap,
      uretilen: v.produced,
    }))
    .sort((a, b) => b.fireOrani - a.fireOrani);

  const selectedWo = workOrders.find(w => String(w.id) === selectedWoId);

  return (
    <div className="space-y-6" data-testid="efficiency-analysis">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          [data-testid="efficiency-analysis"], [data-testid="efficiency-analysis"] * { visibility: visible; }
          [data-testid="efficiency-analysis"] { position: absolute; left: 0; top: 0; width: 100%; }
          .print\\:hidden { display: none !important; }
          .recharts-wrapper { page-break-inside: avoid; }
        }
      `}</style>
      {selectedWoId && (
        <div className="hidden print:block mb-4 border-b pb-4">
          <h1 className="text-2xl font-bold">Verimlilik Analizi Raporu</h1>
          <p className="text-sm text-gray-600 mt-1">
            İş Emri: {selectedWo?.orderNumber} — {selectedWo?.productName}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Oluşturulma: {new Date().toLocaleString("tr-TR")}
          </p>
        </div>
      )}
      <div className="flex items-center justify-between print:hidden">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          Verimlilik Analizi
        </h2>
        <div className="flex items-center gap-2">
          <Popover open={woComboOpen} onOpenChange={setWoComboOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={woComboOpen}
                className="w-72 justify-between"
                data-testid="select-work-order-efficiency"
              >
                {selectedWoId
                  ? (() => {
                      const wo = workOrders.find(w => String(w.id) === selectedWoId);
                      return wo ? `${wo.orderNumber} - ${wo.productName}` : "İş emri seçin";
                    })()
                  : "İş emri seçin (Süre Analizi)"}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
              <Command>
                <CommandInput placeholder="İş emri ara..." data-testid="input-search-work-order-efficiency" />
                <CommandEmpty>İş emri bulunamadı.</CommandEmpty>
                <CommandGroup className="max-h-64 overflow-auto">
                  {workOrders.map(wo => (
                    <CommandItem
                      key={wo.id}
                      value={`${wo.orderNumber} ${wo.productName}`}
                      onSelect={() => {
                        setSelectedWoId(String(wo.id));
                        setWoComboOpen(false);
                      }}
                      data-testid={`option-wo-efficiency-${wo.id}`}
                    >
                      <CheckIcon className={cn("mr-2 h-4 w-4", selectedWoId === String(wo.id) ? "opacity-100" : "opacity-0")} />
                      <span className="flex-1 truncate">{wo.orderNumber} - {wo.productName}</span>
                      <Badge
                        variant={wo.status === "completed" ? "default" : wo.status === "in_progress" ? "secondary" : "outline"}
                        className={cn("ml-1 text-xs", wo.status === "completed" ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300" : wo.status === "in_progress" ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300" : "")}
                      >
                        {wo.status === "completed" ? "Tamam" : wo.status === "in_progress" ? "Devam" : "Bekliyor"}
                      </Badge>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </Command>
            </PopoverContent>
          </Popover>
          {selectedWoId && (
            <Button variant="outline" onClick={handlePrint} data-testid="button-print-efficiency">
              <Printer className="w-4 h-4 mr-2" />
              PDF Raporu
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card data-testid="card-time-comparison">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Planlanan vs Gerçekleşen Süre
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedWoId ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Süre karşılaştırması için bir iş emri seçin.
              </div>
            ) : opsLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : timeComparisonData.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Tamamlanan operasyon bulunamadı.
              </div>
            ) : (
              <>
              {useLogsFallback && (
                <div className="mb-3 p-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Operasyon planı tanımlı değil. Veriler üretim kayıtlarından alınmıştır.
                  </p>
                </div>
              )}
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={timeComparisonData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis label={{ value: "Dakika", angle: -90, position: "insideLeft" }} />
                    <Tooltip formatter={(value: number, name: string) => [
                      `${value} dk`,
                      name === "planlanan" ? "Planlanan" : "Gerçekleşen"
                    ]} />
                    <Legend formatter={(value: string) => value === "planlanan" ? "Planlanan" : "Gerçekleşen"} />
                    <Bar dataKey="planlanan" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="gerceklesen" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>

                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-muted/50">
                        <th className="border p-1.5 text-left">Operasyon</th>
                        <th className="border p-1.5 text-center">Planlanan (dk)</th>
                        <th className="border p-1.5 text-center">Gerçekleşen (dk)</th>
                        <th className="border p-1.5 text-center">Fark (dk)</th>
                        <th className="border p-1.5 text-center">Sapma %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {timeComparisonData.map((row, i) => (
                        <tr key={i} className={Number(row.fark) > 0 ? "bg-red-50 dark:bg-red-950/10" : ""}>
                          <td className="border p-1.5 font-medium">{row.name}</td>
                          <td className="border p-1.5 text-center">{row.planlanan || "-"}</td>
                          <td className="border p-1.5 text-center">{row.gerceklesen}</td>
                          <td className="border p-1.5 text-center">
                            <span className={Number(row.fark) > 0 ? "text-red-600 font-semibold" : "text-green-600"}>
                              {Number(row.fark) > 0 ? `+${row.fark}` : row.fark}
                            </span>
                          </td>
                          <td className="border p-1.5 text-center">
                            <span className={Number(row.farkYuzde) > 0 ? "text-red-600" : "text-green-600"}>
                              {Number(row.farkYuzde) > 0 ? `+${row.farkYuzde}%` : `${row.farkYuzde}%`}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-bottleneck">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Darboğaz Tespiti (Bekleme Süreleri)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedWoId ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Darboğaz analizi için bir iş emri seçin.
              </div>
            ) : (bottleneckData as any[]).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Yeterli tamamlanmış operasyon verisi bulunamadı.
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={bottleneckData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" label={{ value: "Bekleme (dk)", position: "insideBottom", offset: -5 }} />
                    <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value: number) => [`${value} dk`, "Bekleme Süresi"]} />
                    <Bar dataKey="bekleme" radius={[0, 4, 4, 0]}>
                      {(bottleneckData as any[]).map((entry: any, index: number) => (
                        <Cell key={index} fill={entry.bekleme > 60 ? "#ef4444" : entry.bekleme > 30 ? "#f59e0b" : "#22c55e"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>

                <div className="mt-3 space-y-1.5">
                  {(bottleneckData as any[]).slice(0, 5).map((item: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-xs p-1.5 rounded bg-muted/30">
                      <span className="font-medium">{item.fromOp}</span>
                      <ArrowRight className="w-3 h-3 text-muted-foreground" />
                      <span className="font-medium">{item.toOp}</span>
                      <span className="ml-auto font-semibold">
                        <Badge variant={item.bekleme > 60 ? "destructive" : "secondary"}>{item.bekleme} dk</Badge>
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-scrap-rate">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Fire Oranı Raporu (Tüm İş Emirleri - Operasyon Bazında)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {scrapData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Henüz fire verisi bulunmuyor.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={scrapData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis label={{ value: "Fire %", angle: -90, position: "insideLeft" }} />
                  <Tooltip formatter={(value: number, name: string) => [
                    name === "fireOrani" ? `${value}%` : value,
                    name === "fireOrani" ? "Fire Oranı" : name === "fire" ? "Fire Adet" : "Üretilen"
                  ]} />
                  <Bar dataKey="fireOrani" name="Fire Oranı (%)" radius={[4, 4, 0, 0]}>
                    {scrapData.map((entry, index) => (
                      <Cell key={index} fill={entry.fireOrani > 5 ? "#ef4444" : entry.fireOrani > 2 ? "#f59e0b" : "#22c55e"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="border p-1.5 text-left">Operasyon</th>
                      <th className="border p-1.5 text-center">Üretilen</th>
                      <th className="border p-1.5 text-center">Kabul</th>
                      <th className="border p-1.5 text-center">Fire</th>
                      <th className="border p-1.5 text-center">Fire %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scrapData.map((row, i) => (
                      <tr key={i} className={row.fireOrani > 5 ? "bg-red-50 dark:bg-red-950/10" : ""}>
                        <td className="border p-1.5 font-medium">{row.name}</td>
                        <td className="border p-1.5 text-center">{row.uretilen}</td>
                        <td className="border p-1.5 text-center">{row.uretilen - row.fire}</td>
                        <td className="border p-1.5 text-center font-semibold text-red-600">{row.fire}</td>
                        <td className="border p-1.5 text-center">
                          <Badge variant={row.fireOrani > 5 ? "destructive" : row.fireOrani > 2 ? "secondary" : "default"}>
                            {row.fireOrani}%
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
