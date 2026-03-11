import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient as qc } from "@/lib/queryClient";
import {
  GripVertical, Plus, Trash2, Clock, CheckCircle, Loader2,
  AlertTriangle, ArrowUpDown, ChevronDown, ChevronUp,
} from "lucide-react";
import type { Operation, Machine, WorkOrderOperation } from "@shared/schema";

interface WorkOrderOperationsProps {
  workOrderId: number;
  operations: Operation[];
  machines: Machine[];
}

export default function WorkOrderOperationsPanel({ workOrderId, operations, machines }: WorkOrderOperationsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedOperationId, setSelectedOperationId] = useState("");
  const [selectedMachineId, setSelectedMachineId] = useState("");
  const [plannedDuration, setPlannedDuration] = useState("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const { data: woOps = [], isLoading } = useQuery<WorkOrderOperation[]>({
    queryKey: ["/api/work-order-operations", workOrderId],
    queryFn: () => fetch(`/api/work-order-operations/${workOrderId}`, { credentials: "include" }).then(r => r.json()),
  });

  const addMutation = useMutation({
    mutationFn: async (data: { operationId: number; sequenceNumber: number; plannedDurationMinutes?: number; assignedMachineId?: number }) => {
      return apiRequest("POST", `/api/work-order-operations/${workOrderId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-order-operations", workOrderId] });
      setShowAddDialog(false);
      setSelectedOperationId("");
      setSelectedMachineId("");
      setPlannedDuration("");
      toast({ title: "Operasyon eklendi" });
    },
    onError: (err: Error) => toast({ title: "Hata", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/work-order-operations/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-order-operations", workOrderId] });
      toast({ title: "Operasyon kaldırıldı" });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (orderedIds: number[]) => {
      return apiRequest("POST", `/api/work-order-operations/${workOrderId}/reorder`, { orderedIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-order-operations", workOrderId] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return apiRequest("PATCH", `/api/work-order-operations/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-order-operations", workOrderId] });
    },
  });

  const handleAdd = () => {
    if (!selectedOperationId) return;
    addMutation.mutate({
      operationId: Number(selectedOperationId),
      sequenceNumber: woOps.length,
      plannedDurationMinutes: plannedDuration ? Number(plannedDuration) : undefined,
      assignedMachineId: selectedMachineId ? Number(selectedMachineId) : undefined,
    });
  };

  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (index: number) => {
    if (dragIndex === null || dragIndex === index) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    const items = [...woOps];
    const [moved] = items.splice(dragIndex, 1);
    items.splice(index, 0, moved);
    reorderMutation.mutate(items.map(i => i.id));
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const items = [...woOps];
    [items[index - 1], items[index]] = [items[index], items[index - 1]];
    reorderMutation.mutate(items.map(i => i.id));
  };

  const handleMoveDown = (index: number) => {
    if (index >= woOps.length - 1) return;
    const items = [...woOps];
    [items[index], items[index + 1]] = [items[index + 1], items[index]];
    reorderMutation.mutate(items.map(i => i.id));
  };

  const getOperation = (opId: number) => operations.find(o => o.id === opId);
  const getMachine = (mId: number | null) => mId ? machines.find(m => m.id === mId) : null;

  const statusBadge = (status: string) => {
    switch (status) {
      case "completed": return <Badge className="bg-green-600 text-white" data-testid="badge-status-completed">Tamamlandı</Badge>;
      case "in_progress": return <Badge className="bg-blue-600 text-white" data-testid="badge-status-in-progress">Devam Ediyor</Badge>;
      default: return <Badge variant="secondary" data-testid="badge-status-pending">Beklemede</Badge>;
    }
  };

  if (isLoading) return <div className="flex items-center gap-2 py-4"><Loader2 className="w-4 h-4 animate-spin" /> Yükleniyor...</div>;

  return (
    <div className="space-y-3" data-testid="work-order-operations-panel">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <ArrowUpDown className="w-4 h-4" />
          Operasyon Planı ({woOps.length} operasyon)
        </h3>
        <Button size="sm" onClick={() => setShowAddDialog(true)} data-testid="button-add-wo-operation">
          <Plus className="w-3 h-3 mr-1" /> Operasyon Ekle
        </Button>
      </div>

      {woOps.length === 0 && (
        <div className="text-center py-6 text-muted-foreground text-sm border border-dashed rounded-lg">
          Henüz operasyon tanımlanmamış. Operasyon ekleyerek planı oluşturun.
        </div>
      )}

      <div className="space-y-1">
        {woOps.map((woOp, index) => {
          const op = getOperation(woOp.operationId);
          const machine = getMachine(woOp.assignedMachineId);
          const scrap = woOp.producedQuantity - woOp.acceptedQuantity;
          const scrapRate = woOp.producedQuantity > 0 ? ((scrap / woOp.producedQuantity) * 100).toFixed(1) : "0.0";

          return (
            <div
              key={woOp.id}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={() => handleDrop(index)}
              onDragEnd={() => { setDragIndex(null); setDragOverIndex(null); }}
              className={`flex items-center gap-2 p-2 rounded-lg border transition-all cursor-move ${
                dragOverIndex === index ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
              } ${woOp.status === "completed" ? "bg-green-50 dark:bg-green-950/20" : ""}`}
              data-testid={`wo-operation-row-${woOp.id}`}
            >
              <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0" />

              <div className="flex items-center gap-1 flex-shrink-0">
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => handleMoveUp(index)} disabled={index === 0}>
                  <ChevronUp className="w-3 h-3" />
                </Button>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => handleMoveDown(index)} disabled={index >= woOps.length - 1}>
                  <ChevronDown className="w-3 h-3" />
                </Button>
              </div>

              <span className="text-xs font-mono font-bold text-muted-foreground w-8 flex-shrink-0">
                #{index + 1}
              </span>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{op?.code || "?"}</span>
                  <span className="text-sm text-muted-foreground truncate">{op?.name || "Bilinmeyen"}</span>
                  {machine && <Badge variant="outline" className="text-xs">{machine.code}</Badge>}
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                  {woOp.plannedDurationMinutes && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Plan: {woOp.plannedDurationMinutes} dk
                    </span>
                  )}
                  {woOp.producedQuantity > 0 && (
                    <span>Üretilen: {woOp.producedQuantity} | Kabul: {woOp.acceptedQuantity} | Fire: {scrap} ({scrapRate}%)</span>
                  )}
                  {woOp.actualStartDate && (
                    <span>Başlangıç: {new Date(woOp.actualStartDate).toLocaleString("tr-TR")}</span>
                  )}
                  {woOp.actualEndDate && (
                    <span>Bitiş: {new Date(woOp.actualEndDate).toLocaleString("tr-TR")}</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {statusBadge(woOp.status)}

                <Input
                  type="number"
                  placeholder="dk"
                  className="w-16 h-7 text-xs"
                  defaultValue={woOp.plannedDurationMinutes || ""}
                  onBlur={(e) => {
                    const val = e.target.value ? Number(e.target.value) : null;
                    if (val !== woOp.plannedDurationMinutes) {
                      updateMutation.mutate({ id: woOp.id, data: { plannedDurationMinutes: val } });
                    }
                  }}
                  data-testid={`input-planned-duration-${woOp.id}`}
                />

                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                  onClick={() => deleteMutation.mutate(woOp.id)}
                  disabled={woOp.status !== "pending"}
                  data-testid={`button-delete-wo-operation-${woOp.id}`}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Operasyon Ekle</DialogTitle>
            <DialogDescription>Bu iş emrine yeni bir operasyon adımı ekleyin.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Operasyon</label>
              <Select value={selectedOperationId} onValueChange={setSelectedOperationId}>
                <SelectTrigger data-testid="select-operation">
                  <SelectValue placeholder="Operasyon seçin" />
                </SelectTrigger>
                <SelectContent>
                  {operations.map(op => (
                    <SelectItem key={op.id} value={String(op.id)}>{op.code} - {op.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Atanan Tezgah (Opsiyonel)</label>
              <Select value={selectedMachineId} onValueChange={setSelectedMachineId}>
                <SelectTrigger data-testid="select-machine">
                  <SelectValue placeholder="Tezgah seçin" />
                </SelectTrigger>
                <SelectContent>
                  {machines.map(m => (
                    <SelectItem key={m.id} value={String(m.id)}>{m.code} - {m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Planlanan Süre (dakika)</label>
              <Input
                type="number"
                value={plannedDuration}
                onChange={(e) => setPlannedDuration(e.target.value)}
                placeholder="Örn: 120"
                data-testid="input-planned-duration"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setShowAddDialog(false)}>İptal</Button>
            <Button
              onClick={handleAdd}
              disabled={!selectedOperationId || addMutation.isPending}
              data-testid="button-confirm-add-operation"
            >
              {addMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Ekleniyor...</> : "Ekle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
