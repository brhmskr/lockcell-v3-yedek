import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Trash2, UserCheck, Settings2, Users, ImageIcon,
} from "lucide-react";
import type { Machine, User, OperatorAssignment, WorkOrderLine } from "@shared/schema";

export default function OperatorAssignments() {
  const { toast } = useToast();
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedMachineIds, setSelectedMachineIds] = useState<number[]>([]);
  const [selectedWorkOrderLineId, setSelectedWorkOrderLineId] = useState<string>("");

  const { data: assignments, isLoading } = useQuery<OperatorAssignment[]>({
    queryKey: ["/api/operator-assignments"],
  });
  const { data: users } = useQuery<User[]>({ queryKey: ["/api/users"] });
  const { data: machines } = useQuery<Machine[]>({ queryKey: ["/api/machines"] });
  const { data: workOrderLines } = useQuery<WorkOrderLine[]>({ queryKey: ["/api/work-order-lines"] });

  const operators = users?.filter((u) => u.role === "operator") || [];

  const openAdd = () => {
    setSelectedUserId("");
    setSelectedMachineIds([]);
    setSelectedWorkOrderLineId("");
    setShowAddModal(true);
  };

  const toggleMachine = (machineId: number) => {
    setSelectedMachineIds((prev) =>
      prev.includes(machineId) ? prev.filter((id) => id !== machineId) : [...prev, machineId]
    );
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/operator-assignments/bulk", {
        userId: Number(selectedUserId),
        machineIds: selectedMachineIds,
        workOrderLineId: selectedWorkOrderLineId ? Number(selectedWorkOrderLineId) : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operator-assignments"] });
      setShowAddModal(false);
      toast({ title: "Atamalar oluşturuldu" });
    },
    onError: (err: Error) => {
      toast({ title: "Hata", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/operator-assignments/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operator-assignments"] });
      toast({ title: "Atama kaldırıldı" });
    },
    onError: (err: Error) => {
      toast({ title: "Hata", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 rounded-md" />)}
      </div>
    );
  }

  const groupedByOperator: Record<number, OperatorAssignment[]> = {};
  for (const a of assignments || []) {
    if (!groupedByOperator[a.userId]) groupedByOperator[a.userId] = [];
    groupedByOperator[a.userId].push(a);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <UserCheck className="w-5 h-5 text-muted-foreground" />
          Operatör Atamaları
        </h2>
        <Button onClick={openAdd} data-testid="button-add-assignment">
          <Plus className="w-4 h-4 mr-2" />
          Yeni Atama
        </Button>
      </div>

      {Object.keys(groupedByOperator).length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">Henuz operator atamasi yapilmamis.</p>
          </CardContent>
        </Card>
      )}

      {Object.entries(groupedByOperator).map(([userId, userAssignments]) => {
        const operator = operators.find((u) => u.id === Number(userId));
        if (!operator) return null;

        return (
          <Card key={userId} data-testid={`card-operator-group-${userId}`}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{operator.fullName}</p>
                  <p className="text-xs text-muted-foreground">@{operator.username}</p>
                </div>
                <Badge variant="secondary" className="ml-auto text-xs">
                  {userAssignments.length} tezgah
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {userAssignments.map((assignment) => {
                  const machine = machines?.find((m) => m.id === assignment.machineId);
                  const woLine = assignment.workOrderLineId
                    ? workOrderLines?.find((l) => l.id === assignment.workOrderLineId)
                    : null;

                  return (
                    <div
                      key={assignment.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 border border-border/30"
                      data-testid={`card-assignment-${assignment.id}`}
                    >
                      {machine?.imageUrl ? (
                        <img
                          src={machine.imageUrl}
                          alt={machine.name}
                          className="w-10 h-10 rounded-md object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center shrink-0">
                          <ImageIcon className="w-5 h-5 text-muted-foreground/40" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs">{machine?.code}</span>
                          <span className="text-xs text-muted-foreground truncate">{machine?.name}</span>
                        </div>
                        {woLine && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {woLine.productCode} - {woLine.productName}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 h-8 w-8"
                        onClick={() => deleteMutation.mutate(assignment.id)}
                        disabled={deleteMutation.isPending}
                        data-testid={`button-delete-assignment-${assignment.id}`}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}

      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Yeni Operatör Ataması
            </DialogTitle>
            <DialogDescription>Operatöre bir veya birden fazla tezgah atayın.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Operatör *</label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className="h-12" data-testid="select-assignment-operator">
                  <SelectValue placeholder="Operatör seçiniz..." />
                </SelectTrigger>
                <SelectContent>
                  {operators.map((op) => (
                    <SelectItem key={op.id} value={String(op.id)} data-testid={`option-operator-${op.id}`}>
                      {op.fullName} (@{op.username})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Tezgahlar * (birden fazla secilebilir)</label>
              <div className="space-y-2 p-3 bg-muted/50 rounded-md max-h-48 overflow-y-auto">
                {machines?.map((machine) => (
                  <label
                    key={machine.id}
                    className="flex items-center gap-3 cursor-pointer p-2 rounded-md hover:bg-muted transition-colors"
                  >
                    <Checkbox
                      checked={selectedMachineIds.includes(machine.id)}
                      onCheckedChange={() => toggleMachine(machine.id)}
                      data-testid={`checkbox-machine-${machine.id}`}
                    />
                    <div className="flex items-center gap-2">
                      {machine.imageUrl ? (
                        <img src={machine.imageUrl} alt="" className="w-6 h-6 rounded object-cover" />
                      ) : (
                        <div className="w-6 h-6 rounded bg-muted flex items-center justify-center">
                          <Settings2 className="w-3 h-3 text-muted-foreground/40" />
                        </div>
                      )}
                      <Badge variant="secondary" className="font-mono text-xs">{machine.code}</Badge>
                      <span className="text-sm">{machine.name}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">İş Emri Kalemi (istege bagli)</label>
              <Select
                value={selectedWorkOrderLineId}
                onValueChange={(v) => setSelectedWorkOrderLineId(v === "none" ? "" : v)}
              >
                <SelectTrigger className="h-12" data-testid="select-assignment-wol">
                  <SelectValue placeholder="Seçim yapmayabilirsiniz..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Seçim yok</SelectItem>
                  {workOrderLines?.map((line) => (
                    <SelectItem key={line.id} value={String(line.id)} data-testid={`option-wol-${line.id}`}>
                      {line.productCode} - {line.productName} ({line.targetQuantity} adet)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button
                className="w-full h-12"
                onClick={() => createMutation.mutate()}
                disabled={!selectedUserId || selectedMachineIds.length === 0 || createMutation.isPending}
                data-testid="button-save-assignment"
              >
                {createMutation.isPending ? "Kaydediliyor..." : "Atamaları Kaydet"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
