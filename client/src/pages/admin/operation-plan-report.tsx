import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ClipboardList, Printer, CheckCircle, Clock,
  Loader2, ChevronsUpDown, CheckIcon, ShieldCheck, Lock,
} from "lucide-react";
import type { WorkOrder, Operation, Machine, User as UserType, WorkOrderOperation, SystemSettings } from "@shared/schema";
import { cn } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function OperationPlanReport() {
  const [selectedWoId, setSelectedWoId] = useState("");
  const [woComboOpen, setWoComboOpen] = useState(false);
  const { toast } = useToast();

  const approveMutation = useMutation({
    mutationFn: (woOpId: number) =>
      apiRequest("POST", `/api/work-order-operations/${woOpId}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-order-operations", selectedWoId] });
      toast({ title: "Operasyon onaylandı", description: "Dijital onay kaydedildi." });
    },
    onError: (err: any) => {
      toast({ title: "Onay başarısız", description: err?.message || "Bir hata oluştu.", variant: "destructive" });
    },
  });

  const { data: workOrders = [] } = useQuery<WorkOrder[]>({ queryKey: ["/api/work-orders"] });
  const { data: operations = [] } = useQuery<Operation[]>({ queryKey: ["/api/operations"] });
  const { data: machines = [] } = useQuery<Machine[]>({ queryKey: ["/api/machines"] });
  const { data: users = [] } = useQuery<any[]>({ queryKey: ["/api/users"] });
  const { data: productionLogs = [] } = useQuery<any[]>({ queryKey: ["/api/production-logs"] });
  const { data: sysSettings } = useQuery<SystemSettings>({ queryKey: ["/api/system-settings"] });

  const { data: woOps = [], isLoading: opsLoading } = useQuery<WorkOrderOperation[]>({
    queryKey: ["/api/work-order-operations", selectedWoId],
    queryFn: () => selectedWoId ? fetch(`/api/work-order-operations/${selectedWoId}`, { credentials: "include" }).then(r => r.json()) : Promise.resolve([]),
    enabled: !!selectedWoId,
  });

  const selectedWo = workOrders.find(wo => wo.id === Number(selectedWoId));
  const getOp = (id: number) => operations.find(o => o.id === id);
  const getMachine = (id: number | null) => id ? machines.find(m => m.id === id) : null;
  const getUser = (id: number | null) => id ? users.find(u => u.id === id) : null;

  const getActualDurationMinutes = (woOp: WorkOrderOperation) => {
    if (!woOp.actualStartDate || !woOp.actualEndDate) return null;
    const start = new Date(woOp.actualStartDate).getTime();
    const end = new Date(woOp.actualEndDate).getTime();
    return Math.round((end - start) / 60000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6" data-testid="operation-plan-report">
      <div className="flex items-center justify-between print:hidden">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <ClipboardList className="w-5 h-5" />
          Dijital Operasyon Planı Raporu
        </h2>
        <div className="flex items-center gap-3">
          <Popover open={woComboOpen} onOpenChange={setWoComboOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={woComboOpen}
                className="w-72 justify-between"
                data-testid="select-work-order"
              >
                {selectedWoId
                  ? (() => {
                      const wo = workOrders.find(w => String(w.id) === selectedWoId);
                      return wo ? `${wo.orderNumber} - ${wo.productName}` : "İş emri seçin";
                    })()
                  : "İş emri seçin"}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
              <Command>
                <CommandInput placeholder="İş emri ara..." data-testid="input-search-work-order-report" />
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
                      data-testid={`option-wo-report-${wo.id}`}
                    >
                      <CheckIcon className={cn("mr-2 h-4 w-4", selectedWoId === String(wo.id) ? "opacity-100" : "opacity-0")} />
                      <span className="flex-1 truncate">{wo.orderNumber} - {wo.productName}</span>
                      <Badge
                        variant="outline"
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
            <Button onClick={handlePrint} data-testid="button-print-pdf">
              <Printer className="w-4 h-4 mr-2" />
              PDF Dışa Aktar
            </Button>
          )}
        </div>
      </div>

      {!selectedWoId && (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <ClipboardList className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg">Operasyon planı görüntülemek için bir iş emri seçin.</p>
          </CardContent>
        </Card>
      )}

      {selectedWoId && selectedWo && (
        <div className="print-area">
          <Card className="print:shadow-none print:border-2 print:border-black">
            <CardHeader className="border-b print:border-b-2 print:border-black">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  {sysSettings?.companyLogo ? (
                    <img
                      src={sysSettings.companyLogo}
                      alt="Logo"
                      className="h-12 w-auto object-contain"
                      data-testid="img-company-logo-report"
                    />
                  ) : null}
                  <div>
                    <CardTitle className="text-lg">
                      {sysSettings?.companyName || "LOCKCELL MES"}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5 print:text-black">
                      LOCKCELL MES — Dijital Üretim Takip Sistemi
                    </p>
                    {(sysSettings?.phone || sysSettings?.email || sysSettings?.webSite) && (
                      <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground print:text-gray-600">
                        {sysSettings?.phone && <span>{sysSettings.phone}</span>}
                        {sysSettings?.email && <span>{sysSettings.email}</span>}
                        {sysSettings?.webSite && <span>{sysSettings.webSite}</span>}
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right text-sm shrink-0">
                  <p className="font-semibold">OPERASYON PLANI</p>
                  <p className="text-xs text-muted-foreground print:text-black mt-0.5">
                    {new Date().toLocaleDateString("tr-TR")}
                  </p>
                  {sysSettings?.address && (
                    <p className="text-xs text-muted-foreground print:text-gray-600 mt-0.5 max-w-48 text-right">
                      {sysSettings.address}
                    </p>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 p-3 bg-muted/50 rounded-lg print:bg-gray-100">
                <div>
                  <p className="text-xs text-muted-foreground print:text-gray-600">İş Emri No</p>
                  <p className="font-semibold" data-testid="text-wo-number">{selectedWo.orderNumber}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground print:text-gray-600">Ürün Adı</p>
                  <p className="font-semibold">{selectedWo.productName}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground print:text-gray-600">Müşteri</p>
                  <p className="font-semibold">{selectedWo.customerName || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground print:text-gray-600">Teslim Tarihi</p>
                  <p className="font-semibold">{selectedWo.dueDate ? new Date(selectedWo.dueDate).toLocaleDateString("tr-TR") : "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground print:text-gray-600">Hedef Adet</p>
                  <p className="font-semibold">{selectedWo.targetQuantity}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground print:text-gray-600">Tamamlanan Adet</p>
                  <p className="font-semibold">{selectedWo.completedQuantity}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground print:text-gray-600">Durum</p>
                  <Badge variant={selectedWo.status === "completed" ? "default" : "secondary"}>
                    {selectedWo.status === "completed" ? "Tamamlandı" : selectedWo.status === "in_progress" ? "Devam Ediyor" : "Beklemede"}
                  </Badge>
                </div>
              </div>

              {opsLoading ? (
                <div className="space-y-2">
                  {[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : woOps.length === 0 ? (
                (() => {
                  const woLogs = productionLogs.filter((l: any) => l.workOrderId === Number(selectedWoId) && l.status === "completed");
                  if (woLogs.length === 0) {
                    return (
                      <div className="text-center py-8 text-muted-foreground" data-testid="text-no-route">
                        <p className="font-semibold text-amber-600 mb-1">Varsayılan Rota Yok</p>
                        <p className="text-sm">Bu iş emri için operasyon planı tanımlanmamış. Üretim kayıtlarından veri de bulunamadı.</p>
                      </div>
                    );
                  }
                  return (
                    <div>
                      <div className="mb-3 p-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                        <p className="text-sm text-amber-700 dark:text-amber-400 font-medium">
                          Operasyon planı tanımlı değil. Aşağıdaki veriler üretim kayıtlarından otomatik oluşturulmuştur.
                        </p>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm border-collapse print:text-xs" data-testid="operation-plan-table-dynamic">
                          <thead>
                            <tr className="bg-muted/70 print:bg-gray-200">
                              <th className="border p-2 text-left font-semibold">Sıra</th>
                              <th className="border p-2 text-left font-semibold">Op. Kodu</th>
                              <th className="border p-2 text-left font-semibold">Tanımı</th>
                              <th className="border p-2 text-left font-semibold">İstasyon</th>
                              <th className="border p-2 text-left font-semibold">Başlangıç</th>
                              <th className="border p-2 text-left font-semibold">Bitiş</th>
                              <th className="border p-2 text-center font-semibold">Süre (dk)</th>
                              <th className="border p-2 text-center font-semibold">Üretilen</th>
                              <th className="border p-2 text-left font-semibold">Sorumlu</th>
                            </tr>
                          </thead>
                          <tbody>
                            {woLogs.map((log: any, idx: number) => {
                              const op = operations.find(o => o.id === log.operationId);
                              const machine = machines.find(m => m.id === log.machineId);
                              const user = users.find((u: any) => u.id === log.userId);
                              const dur = log.startTime && log.endTime ? Math.round((new Date(log.endTime).getTime() - new Date(log.startTime).getTime()) / 60000) : null;
                              return (
                                <tr key={log.id} className="hover:bg-muted/30">
                                  <td className="border p-2 text-center font-mono">{idx + 1}</td>
                                  <td className="border p-2 font-medium">{op?.code || "-"}</td>
                                  <td className="border p-2">{op?.name || "-"}</td>
                                  <td className="border p-2">{machine ? `${machine.code} - ${machine.name}` : "-"}</td>
                                  <td className="border p-2 text-xs">{log.startTime ? new Date(log.startTime).toLocaleString("tr-TR") : "-"}</td>
                                  <td className="border p-2 text-xs">{log.endTime ? new Date(log.endTime).toLocaleString("tr-TR") : "-"}</td>
                                  <td className="border p-2 text-center">{dur !== null ? dur : "-"}</td>
                                  <td className="border p-2 text-center">{log.producedQuantity || 0}</td>
                                  <td className="border p-2">{user?.fullName || "-"}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse print:text-xs" data-testid="operation-plan-table">
                    <thead>
                      <tr className="bg-muted/70 print:bg-gray-200">
                        <th className="border p-2 text-left font-semibold">Sıra</th>
                        <th className="border p-2 text-left font-semibold">Op. Kodu</th>
                        <th className="border p-2 text-left font-semibold">Tanımı</th>
                        <th className="border p-2 text-left font-semibold">İstasyon</th>
                        <th className="border p-2 text-center font-semibold">Plan Süre (dk)</th>
                        <th className="border p-2 text-left font-semibold">Gerçekleşen Başlangıç</th>
                        <th className="border p-2 text-left font-semibold">Gerçekleşen Bitiş</th>
                        <th className="border p-2 text-center font-semibold">Gerçekleşen Süre (dk)</th>
                        <th className="border p-2 text-center font-semibold">Üretilen</th>
                        <th className="border p-2 text-center font-semibold">Kabul</th>
                        <th className="border p-2 text-center font-semibold">Fire</th>
                        <th className="border p-2 text-left font-semibold">Sorumlu</th>
                        <th className="border p-2 text-left font-semibold">Dijital Onay</th>
                        <th className="border p-2 text-center font-semibold">Durum</th>
                      </tr>
                    </thead>
                    <tbody>
                      {woOps.map((woOp, idx) => {
                        const op = getOp(woOp.operationId);
                        const machine = getMachine(woOp.assignedMachineId);
                        const user = getUser(woOp.assignedUserId);
                        const actualDuration = getActualDurationMinutes(woOp);
                        const scrap = woOp.producedQuantity - woOp.acceptedQuantity;

                        return (
                          <tr key={woOp.id} className={`${woOp.status === "completed" ? "bg-green-50 dark:bg-green-950/10" : ""} hover:bg-muted/30`}>
                            <td className="border p-2 text-center font-mono">{idx + 1}</td>
                            <td className="border p-2 font-medium">{op?.code || "-"}</td>
                            <td className="border p-2">{op?.name || "-"}</td>
                            <td className="border p-2">{machine ? `${machine.code} - ${machine.name}` : "-"}</td>
                            <td className="border p-2 text-center">{woOp.plannedDurationMinutes || "-"}</td>
                            <td className="border p-2 text-xs">{woOp.actualStartDate ? new Date(woOp.actualStartDate).toLocaleString("tr-TR") : "-"}</td>
                            <td className="border p-2 text-xs">{woOp.actualEndDate ? new Date(woOp.actualEndDate).toLocaleString("tr-TR") : "-"}</td>
                            <td className="border p-2 text-center">
                              {actualDuration !== null ? (
                                <span className={actualDuration > (woOp.plannedDurationMinutes || Infinity) ? "text-red-600 font-semibold" : ""}>
                                  {actualDuration}
                                </span>
                              ) : "-"}
                            </td>
                            <td className="border p-2 text-center">{woOp.producedQuantity || "-"}</td>
                            <td className="border p-2 text-center">{woOp.acceptedQuantity || "-"}</td>
                            <td className="border p-2 text-center">
                              {scrap > 0 ? <span className="text-red-600 font-semibold">{scrap}</span> : "-"}
                            </td>
                            <td className="border p-2">{user?.fullName || "-"}</td>
                            <td className="border p-2 text-xs min-w-[160px]">
                              {woOp.approvalName ? (
                                <div className="flex flex-col gap-0.5 text-green-800 dark:text-green-300 print:text-green-900">
                                  <div className="flex items-center gap-1 font-bold text-green-700 dark:text-green-400">
                                    <ShieldCheck className="w-4 h-4 shrink-0" />
                                    ONAYLANDI
                                  </div>
                                  <div className="font-medium">{woOp.approvalName}</div>
                                  {woOp.approvalRegistrationNumber && (
                                    <div className="font-mono text-xs text-green-600 dark:text-green-500">
                                      SN: {woOp.approvalRegistrationNumber}
                                    </div>
                                  )}
                                  <div className="text-xs text-muted-foreground print:text-gray-600">
                                    {woOp.approvalDate ? new Date(woOp.approvalDate).toLocaleString("tr-TR") : ""}
                                  </div>
                                  <div className="flex items-center gap-1 mt-0.5 text-muted-foreground print:text-gray-500">
                                    <Lock className="w-3 h-3" />
                                    <span className="font-mono text-xs">{woOp.approvalCode}</span>
                                  </div>
                                </div>
                              ) : woOp.status === "completed" ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-400 print:hidden"
                                  onClick={() => approveMutation.mutate(woOp.id)}
                                  disabled={approveMutation.isPending}
                                  data-testid={`button-approve-op-${woOp.id}`}
                                >
                                  {approveMutation.isPending ? (
                                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                  ) : (
                                    <ShieldCheck className="w-3 h-3 mr-1" />
                                  )}
                                  Onayla
                                </Button>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </td>
                            <td className="border p-2 text-center">
                              {woOp.status === "completed" ? (
                                <CheckCircle className="w-4 h-4 text-green-600 mx-auto" />
                              ) : woOp.status === "in_progress" ? (
                                <Clock className="w-4 h-4 text-blue-600 mx-auto animate-pulse" />
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="mt-6 pt-4 border-t print:border-t-2 print:border-black grid grid-cols-3 gap-4 text-xs text-muted-foreground print:text-gray-600">
                <div>
                  <p className="font-medium">Toplam Operasyon</p>
                  <p className="text-foreground text-sm font-semibold print:text-black">{woOps.length}</p>
                </div>
                <div>
                  <p className="font-medium">Tamamlanan</p>
                  <p className="text-foreground text-sm font-semibold print:text-black">{woOps.filter(o => o.status === "completed").length} / {woOps.length}</p>
                </div>
                <div>
                  <p className="font-medium">Toplam Fire</p>
                  <p className="text-foreground text-sm font-semibold print:text-black">
                    {woOps.reduce((sum, o) => sum + (o.producedQuantity - o.acceptedQuantity), 0)} adet
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: absolute; left: 0; top: 0; width: 100%; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
}
