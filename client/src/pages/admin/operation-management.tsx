import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Cog, Save, AlertTriangle, ArrowUp, ArrowDown } from "lucide-react";
import type { Operation } from "@shared/schema";

export default function OperationManagement() {
  const { toast } = useToast();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editOp, setEditOp] = useState<Operation | null>(null);
  const [deleteOp, setDeleteOp] = useState<Operation | null>(null);

  const [formName, setFormName] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formDesc, setFormDesc] = useState("");

  const { data: operations, isLoading } = useQuery<Operation[]>({ queryKey: ["/api/operations"] });

  const openAdd = () => {
    setFormName("");
    setFormCode("");
    setFormDesc("");
    setShowAddModal(true);
  };

  const openEdit = (op: Operation) => {
    setFormName(op.name);
    setFormCode(op.code);
    setFormDesc(op.description || "");
    setEditOp(op);
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/operations", {
        name: formName,
        code: formCode,
        description: formDesc || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations"] });
      setShowAddModal(false);
      toast({ title: "Operasyon eklendi" });
    },
    onError: (err: Error) => {
      toast({ title: "Hata", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editOp) return;
      await apiRequest("PATCH", `/api/operations/${editOp.id}`, {
        name: formName,
        code: formCode,
        description: formDesc || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations"] });
      setEditOp(null);
      toast({ title: "Operasyon güncellendi" });
    },
    onError: (err: Error) => {
      toast({ title: "Hata", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!deleteOp) return;
      await apiRequest("DELETE", `/api/operations/${deleteOp.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations"] });
      setDeleteOp(null);
      toast({ title: "Operasyon silindi" });
    },
    onError: (err: Error) => {
      toast({ title: "Hata", description: err.message, variant: "destructive" });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (orderedIds: number[]) => {
      await apiRequest("POST", "/api/operations/reorder", { orderedIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations"] });
    },
    onError: (err: Error) => {
      toast({ title: "Hata", description: err.message, variant: "destructive" });
    },
  });

  const moveOperation = (index: number, direction: "up" | "down") => {
    if (!operations) return;
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= operations.length) return;
    const reordered = [...operations];
    [reordered[index], reordered[newIndex]] = [reordered[newIndex], reordered[index]];
    const orderedIds = reordered.map((o) => o.id);
    queryClient.setQueryData(["/api/operations"], reordered);
    reorderMutation.mutate(orderedIds);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2" data-testid="text-operations-title">
            <Cog className="w-5 h-5 text-muted-foreground" />
            Operasyon Tanımları
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {operations?.length || 0} operasyon tanımlı
          </p>
        </div>
        <Button onClick={openAdd} className="gap-2" data-testid="button-add-operation">
          <Plus className="w-4 h-4" />
          Yeni Operasyon
        </Button>
      </div>

      <div className="space-y-2">
        {operations?.map((op, index) => (
          <Card key={op.id} className="border-border/50" data-testid={`card-operation-${op.id}`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-0.5 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={index === 0}
                    onClick={() => moveOperation(index, "up")}
                    data-testid={`button-move-up-op-${op.id}`}
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={index === (operations?.length || 0) - 1}
                    onClick={() => moveOperation(index, "down")}
                    data-testid={`button-move-down-op-${op.id}`}
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-primary bg-primary/10 px-2 py-0.5 rounded" data-testid={`text-op-code-${op.id}`}>
                      {op.code}
                    </span>
                  </div>
                  <h3 className="font-semibold text-base mt-1 truncate" data-testid={`text-op-name-${op.id}`}>
                    {op.name}
                  </h3>
                  {op.description && (
                    <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1" data-testid={`text-op-desc-${op.id}`}>
                      {op.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => openEdit(op)}
                    data-testid={`button-edit-op-${op.id}`}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => setDeleteOp(op)}
                    data-testid={`button-delete-op-${op.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {(!operations || operations.length === 0) && (
          <div className="text-center py-12 text-muted-foreground">
            Henüz operasyon tanımlanmamış.
          </div>
        )}
      </div>

      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Yeni Operasyon Ekle</DialogTitle>
            <DialogDescription>Üretim sürecinde kullanılacak yeni bir operasyon tanımlayın.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Operasyon Kodu</label>
              <Input
                value={formCode}
                onChange={(e) => setFormCode(e.target.value)}
                placeholder="örn: OP10"
                data-testid="input-op-code"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Operasyon Adı</label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="örn: Kesim"
                data-testid="input-op-name"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Açıklama (Opsiyonel)</label>
              <Textarea
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                placeholder="Bu operasyonun kısa açıklaması..."
                rows={3}
                data-testid="input-op-desc"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              className="w-full gap-2"
              disabled={!formName || !formCode || createMutation.isPending}
              onClick={() => createMutation.mutate()}
              data-testid="button-save-operation"
            >
              <Save className="w-4 h-4" />
              {createMutation.isPending ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editOp} onOpenChange={(open) => { if (!open) setEditOp(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Operasyonu Düzenle</DialogTitle>
            <DialogDescription>Operasyon bilgilerini güncelleyin.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Operasyon Kodu</label>
              <Input
                value={formCode}
                onChange={(e) => setFormCode(e.target.value)}
                placeholder="örn: OP10"
                data-testid="input-edit-op-code"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Operasyon Adı</label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="örn: Kesim"
                data-testid="input-edit-op-name"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Açıklama (Opsiyonel)</label>
              <Textarea
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                placeholder="Bu operasyonun kısa açıklaması..."
                rows={3}
                data-testid="input-edit-op-desc"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              className="w-full gap-2"
              disabled={!formName || !formCode || updateMutation.isPending}
              onClick={() => updateMutation.mutate()}
              data-testid="button-update-operation"
            >
              <Save className="w-4 h-4" />
              {updateMutation.isPending ? "Kaydediliyor..." : "Güncelle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteOp} onOpenChange={(open) => { if (!open) setDeleteOp(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Operasyonu Sil
            </DialogTitle>
            <DialogDescription>
              <strong>{deleteOp?.code} - {deleteOp?.name}</strong> operasyonunu silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteOp(null)} data-testid="button-cancel-delete-op">
              Vazgec
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}
              data-testid="button-confirm-delete-op"
            >
              {deleteMutation.isPending ? "Siliniyor..." : "Sil"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
