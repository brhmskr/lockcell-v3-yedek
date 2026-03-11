import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import { Gauge, Clock, AlertTriangle, TrendingUp, DollarSign } from "lucide-react";
import type { Machine, ProductionLog, StopLog, StopReason } from "@shared/schema";

interface ReportData {
  productionLogs: ProductionLog[];
  stopLogs: StopLog[];
  machines: Machine[];
  workOrders: any[];
  operations: any[];
  users: any[];
  stopReasons: StopReason[];
}

type Period = "weekly" | "monthly" | "yearly";

const COLORS = [
  "hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))",
  "hsl(var(--chart-4))", "hsl(var(--chart-5))",
  "#f97316", "#06b6d4", "#8b5cf6", "#ec4899", "#14b8a6",
];

function getHoursDiff(start: string | Date | null, end: string | Date | null): number {
  if (!start) return 0;
  const s = new Date(start);
  const e = end ? new Date(end) : new Date();
  return Math.max(0, (e.getTime() - s.getTime()) / (1000 * 60 * 60));
}

function isInPeriod(date: string | Date | null, period: Period): boolean {
  if (!date) return false;
  const d = new Date(date);
  const now = new Date();

  if (period === "weekly") {
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    return d >= weekAgo && d <= now;
  }
  if (period === "monthly") {
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }
  return d.getFullYear() === now.getFullYear();
}

export default function MachineEfficiency() {
  const [period, setPeriod] = useState<Period>("monthly");
  const { data, isLoading } = useQuery<ReportData>({ queryKey: ["/api/reports/production"] });

  const machineStats = useMemo(() => {
    if (!data) return [];

    return data.machines.map((machine) => {
      const machineLogs = data.productionLogs.filter(
        (l) => l.machineId === machine.id && isInPeriod(l.startTime, period)
      );

      let totalRunHours = 0;
      let totalStopHours = 0;
      const stopReasonMap: Record<string, number> = {};

      machineLogs.forEach((log) => {
        const logStops = data.stopLogs.filter((s) => s.productionLogId === log.id);

        let logStopHours = 0;
        logStops.forEach((stop) => {
          const hours = getHoursDiff(stop.startTime, stop.endTime);
          logStopHours += hours;

          const reason = data.stopReasons.find((r) => r.id === stop.stopReasonId);
          const reasonName = reason?.name || "Bilinmeyen";
          stopReasonMap[reasonName] = (stopReasonMap[reasonName] || 0) + hours;
        });

        const totalLogHours = getHoursDiff(log.startTime, log.endTime);
        totalRunHours += Math.max(0, totalLogHours - logStopHours);
        totalStopHours += logStopHours;
      });

      const totalHours = totalRunHours + totalStopHours;
      const oee = totalHours > 0 ? (totalRunHours / totalHours) * 100 : 0;
      const cost = totalRunHours * parseFloat(machine.hourlyCost || "0");

      const stopReasonData = Object.entries(stopReasonMap).map(([name, hours]) => ({
        name,
        value: Math.round(hours * 100) / 100,
      }));

      return {
        machine,
        totalRunHours: Math.round(totalRunHours * 100) / 100,
        totalStopHours: Math.round(totalStopHours * 100) / 100,
        oee: Math.round(oee * 10) / 10,
        cost: Math.round(cost * 100) / 100,
        stopReasonData,
        logCount: machineLogs.length,
      };
    });
  }, [data, period]);

  const barChartData = machineStats.map((s) => ({
    name: s.machine.code,
    oee: s.oee,
    calisma: s.totalRunHours,
    durus: s.totalStopHours,
  }));

  const overallRunHours = machineStats.reduce((s, m) => s + m.totalRunHours, 0);
  const overallStopHours = machineStats.reduce((s, m) => s + m.totalStopHours, 0);
  const overallTotal = overallRunHours + overallStopHours;
  const overallOee = overallTotal > 0 ? (overallRunHours / overallTotal) * 100 : 0;
  const overallCost = machineStats.reduce((s, m) => s + m.cost, 0);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2" data-testid="text-efficiency-title">
            <Gauge className="w-5 h-5 text-muted-foreground" />
            Tezgah Verimlilik Raporu (OEE)
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Tezgah bazında çalışma süresi, duruş analizi ve verimlilik
          </p>
        </div>
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          {([
            { id: "weekly" as Period, label: "Haftalık" },
            { id: "monthly" as Period, label: "Aylık" },
            { id: "yearly" as Period, label: "Yıllık" },
          ]).map((p) => (
            <Button
              key={p.id}
              variant={period === p.id ? "default" : "ghost"}
              size="sm"
              onClick={() => setPeriod(p.id)}
              data-testid={`button-period-${p.id}`}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Gauge className="w-3.5 h-3.5" />
              Genel OEE
            </div>
            <p className="text-2xl font-bold" data-testid="text-overall-oee">
              %{Math.round(overallOee * 10) / 10}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <TrendingUp className="w-3.5 h-3.5" />
              Çalışma
            </div>
            <p className="text-2xl font-bold" data-testid="text-total-run-hours">
              {Math.round(overallRunHours * 10) / 10}s
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              Duruş
            </div>
            <p className="text-2xl font-bold" data-testid="text-total-stop-hours">
              {Math.round(overallStopHours * 10) / 10}s
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <DollarSign className="w-3.5 h-3.5" />
              Toplam Maliyet
            </div>
            <p className="text-2xl font-bold" data-testid="text-total-machine-cost">
              {overallCost.toLocaleString("tr-TR", { minimumFractionDigits: 0 })} €
            </p>
          </CardContent>
        </Card>
      </div>

      {barChartData.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold mb-4">Tezgah Karşılaştırması</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={barChartData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    color: "hsl(var(--foreground))",
                  }}
                  formatter={(value: number, name: string) => [
                    `${value} saat`,
                    name === "calisma" ? "Çalışma" : name === "durus" ? "Duruş" : "OEE %",
                  ]}
                />
                <Bar dataKey="calisma" fill="hsl(var(--chart-2))" name="Çalışma" radius={[4, 4, 0, 0]} />
                <Bar dataKey="durus" fill="hsl(var(--chart-1))" name="Duruş" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {machineStats.map((stat) => (
          <Card key={stat.machine.id} data-testid={`card-machine-oee-${stat.machine.id}`}>
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{stat.machine.name}</h3>
                  <p className="text-xs text-muted-foreground font-mono">{stat.machine.code}</p>
                </div>
                <Badge
                  variant={stat.oee >= 75 ? "default" : stat.oee >= 50 ? "secondary" : "destructive"}
                  className="text-sm px-3 py-1"
                  data-testid={`badge-oee-${stat.machine.id}`}
                >
                  OEE: %{stat.oee}
                </Badge>
              </div>

              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="p-2 bg-muted/50 rounded-md text-center">
                  <p className="text-xs text-muted-foreground">Çalışma</p>
                  <p className="font-semibold">{stat.totalRunHours}s</p>
                </div>
                <div className="p-2 bg-muted/50 rounded-md text-center">
                  <p className="text-xs text-muted-foreground">Duruş</p>
                  <p className="font-semibold">{stat.totalStopHours}s</p>
                </div>
                <div className="p-2 bg-muted/50 rounded-md text-center">
                  <p className="text-xs text-muted-foreground">Maliyet</p>
                  <p className="font-semibold">{stat.cost.toLocaleString("tr-TR")} €</p>
                </div>
              </div>

              {stat.stopReasonData.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Duruş Nedenleri Dağılımı</p>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie
                        data={stat.stopReasonData}
                        cx="50%"
                        cy="50%"
                        outerRadius={65}
                        innerRadius={35}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}s`}
                        labelLine={false}
                      >
                        {stat.stopReasonData.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          color: "hsl(var(--foreground))",
                        }}
                        formatter={(value: number) => [`${value} saat`]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}

              {stat.stopReasonData.length === 0 && stat.logCount === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Bu dönemde üretim kaydı yok
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
