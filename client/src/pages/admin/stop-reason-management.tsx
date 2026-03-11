import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, AlertTriangle, Save } from "lucide-react";
import type { StopReason } from "@shared/schema";

export default function StopReasonManagement() {
  const { toast } = useToast();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editReason, setEditReason] = useState<StopReason | null>(null);
  const [deleteReason, setDeleteReason] = useState<StopReason | null>(null);

  const [formName, setFormName] = useState("");
  const [formCode, setFormCode] = useState("");

  const { data: reasons, isLoading } = useQuery<StopReason[]>({ queryKey: ["/api/stop-reasons"] });

  const openAdd = () => {
    setFormName("");
    setFormCode("");
    setShowAddModal(true);
  };

  const openEdit = (reason: StopReason) => {
    setFormName(reason.name);
    setFormCode(reason.code);
    setEditReason(reason);
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/stop-reasons", {
        name: formName,
        code: formCode,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stop-reasons"] });
      setShowAddModal(false);
      toast({ title: "Duruş nedeni eklendi" });
    },
    onError: (err: Error) => {
      toast({ title: "Hata", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editReason) return;
      await apiRequest("PATCH", `/api/stop-reasons/${editReason.id}`, {
        name: formName,
        code: formCode,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stop-reasons"] });
      setEditReason(null);
      toast({ title: "Duruş nedeni güncellendi" });
    },
    onError: (err: Error) => {
      toast({ title: "Hata", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!deleteReason) return;
      await apiRequest("DELETE", `/api/stop-reasons/${deleteReason.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stop-reasons"] });
      setDeleteReason(null);
      toast({ title: "Duruş nedeni silindi" });
    },
    onError: (err: Error) => {
      toast({ title: "Hata", description: err.message, variant: "destructive" });
    },
  });

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
          <h2 className="text-lg font-semibold flex items-center gap-2" data-testid="text-stop-reasons-title">
            <AlertTriangle className="w-5 h-5 text-muted-foreground" />
            Duruş Nedenleri Yönetimi
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {reasons?.length || 0} duruş nedeni tanımlı
          </p>
        </div>
        <Button onClick={openAdd} className="gap-2" data-testid="button-add-stop-reason">
          <Plus className="w-4 h-4" />
          Yeni Duruş Nedeni
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {reasons?.map((reason) => (
          <Card key={reason.id} className="border-border/50" data-testid={`card-reason-${reason.id}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-base truncate" data-testid={`text-reason-name-${reason.id}`}>
                    {reason.name}
                  </h3>
                  <p className="text-sm text-muted-foreground font-mono mt-1" data-testid={`text-reason-code-${reason.id}`}>
                    {reason.code}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => openEdit(reason)}
                    data-testid={`button-edit-reason-${reason.id}`}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => setDeleteReason(reason)}
                    data-testid={`button-delete-reason-${reason.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {(!reasons || reasons.length === 0) && (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            Henüz duruş nedeni tanımlanmamış.
          </div>
        )}
      </div>

      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Yeni Duruş Nedeni Ekle</DialogTitle>
            <DialogDescription>Operatörlerin seçebileceği yeni bir duruş nedeni tanımlayın.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Neden Adı</label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="örn: Kalıp Değişimi"
                data-testid="input-reason-name"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Kod</label>
              <Input
                value={formCode}
                onChange={(e) => setFormCode(e.target.value)}
                placeholder="örn: kalıp"
                data-testid="input-reason-code"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              className="w-full gap-2"
              disabled={!formName || !formCode || createMutation.isPending}
              onClick={() => createMutation.mutate()}
              data-testid="button-save-reason"
            >
              <Save className="w-4 h-4" />
              {createMutation.isPending ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editReason} onOpenChange={(open) => { if (!open) setEditReason(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Duruş Nedenini Düzenle</DialogTitle>
            <DialogDescription>Duruş nedeninin bilgilerini güncelleyin.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Neden Adı</label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="örn: Kalıp Değişimi"
                data-testid="input-edit-reason-name"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Kod</label>
              <Input
                value={formCode}
                onChange={(e) => setFormCode(e.target.value)}
                placeholder="örn: kalıp"
                data-testid="input-edit-reason-code"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              className="w-full gap-2"
              disabled={!formName || !formCode || updateMutation.isPending}
              onClick={() => updateMutation.mutate()}
              data-testid="button-update-reason"
            >
              <Save className="w-4 h-4" />
              {updateMutation.isPending ? "Kaydediliyor..." : "Güncelle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteReason} onOpenChange={(open) => { if (!open) setDeleteReason(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Duruş Nedenini Sil
            </DialogTitle>
            <DialogDescription>
              <strong>{deleteReason?.name}</strong> duruş nedenini silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteReason(null)} data-testid="button-cancel-delete">
              Vazgec
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}
              data-testid="button-confirm-delete-reason"
            >
              {deleteMutation.isPending ? "Siliniyor..." : "Sil"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
