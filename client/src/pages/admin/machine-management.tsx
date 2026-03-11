import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Pencil, Trash2, Cog, X, Save, Settings2, ArrowUp, ArrowDown, GripVertical, ImageIcon, Upload, Loader2,
} from "lucide-react";
import type { Machine, Operation } from "@shared/schema";

export default function MachineManagement() {
  const { toast } = useToast();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editMachine, setEditMachine] = useState<Machine | null>(null);
  const [deleteMachine, setDeleteMachine] = useState<Machine | null>(null);

  const [formName, setFormName] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formHourlyCost, setFormHourlyCost] = useState("0");
  const [formImageUrl, setFormImageUrl] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formOps, setFormOps] = useState<number[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const { data: machines, isLoading } = useQuery<Machine[]>({ queryKey: ["/api/machines"] });
  const { data: operations } = useQuery<Operation[]>({ queryKey: ["/api/operations"] });

  const openAdd = () => {
    setFormName("");
    setFormCode("");
    setFormHourlyCost("0");
    setFormImageUrl("");
    setFormDescription("");
    setFormOps([]);
    setShowAddModal(true);
  };

  const openEdit = async (machine: Machine) => {
    setFormName(machine.name);
    setFormCode(machine.code);
    setFormHourlyCost(machine.hourlyCost || "0");
    setFormImageUrl(machine.imageUrl || "");
    setFormDescription(machine.description || "");
    setEditMachine(machine);
    try {
      const res = await fetch(`/api/machines/${machine.id}/operations`);
      const ops: number[] = await res.json();
      setFormOps(ops);
    } catch {
      setFormOps([]);
    }
  };

  const toggleOp = (opId: number) => {
    setFormOps((prev) =>
      prev.includes(opId) ? prev.filter((id) => id !== opId) : [...prev, opId]
    );
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Hata", description: "Lütfen bir resim dosyası seçin (PNG, JPEG).", variant: "destructive" });
      return;
    }
    setIsUploading(true);
    try {
      const urlRes = await fetch("/api/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      });
      if (!urlRes.ok) throw new Error("Yükleme URL'si alınamadı.");
      const { uploadURL, objectPath } = await urlRes.json();
      const putRes = await fetch(uploadURL, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      if (!putRes.ok) throw new Error("Dosya yüklenemedi.");
      setFormImageUrl(objectPath);
      toast({ title: "Resim yüklendi" });
    } catch (err: any) {
      toast({ title: "Hata", description: err.message || "Resim yüklenirken sorun oluştu.", variant: "destructive" });
    } finally {
      setIsUploading(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/machines", {
        name: formName,
        code: formCode,
        hourlyCost: formHourlyCost,
        imageUrl: formImageUrl || undefined,
        description: formDescription || undefined,
        allowedOperations: formOps,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/machines"] });
      setShowAddModal(false);
      toast({ title: "Tezgah eklendi" });
    },
    onError: (err: Error) => {
      toast({ title: "Hata", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editMachine) return;
      await apiRequest("PATCH", `/api/machines/${editMachine.id}`, {
        name: formName,
        code: formCode,
        hourlyCost: formHourlyCost,
        imageUrl: formImageUrl || null,
        description: formDescription || null,
        allowedOperations: formOps,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/machines"] });
      setEditMachine(null);
      toast({ title: "Tezgah güncellendi" });
    },
    onError: (err: Error) => {
      toast({ title: "Hata", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/machines/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/machines"] });
      setDeleteMachine(null);
      toast({ title: "Tezgah silindi" });
    },
    onError: (err: Error) => {
      toast({ title: "Hata", description: err.message, variant: "destructive" });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (orderedIds: number[]) => {
      await apiRequest("POST", "/api/machines/reorder", { orderedIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/machines"] });
    },
    onError: (err: Error) => {
      toast({ title: "Hata", description: err.message, variant: "destructive" });
    },
  });

  const moveMachine = (index: number, direction: "up" | "down") => {
    if (!machines) return;
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= machines.length) return;
    const reordered = [...machines];
    [reordered[index], reordered[newIndex]] = [reordered[newIndex], reordered[index]];
    const orderedIds = reordered.map((m) => m.id);
    queryClient.setQueryData(["/api/machines"], reordered);
    reorderMutation.mutate(orderedIds);
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 rounded-md" />)}
      </div>
    );
  }

  const machineFormContent = (onSubmit: () => void, isPending: boolean) => (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
      <div className="space-y-2">
        <label className="text-sm font-medium">Tezgah Adı *</label>
        <Input
          value={formName}
          onChange={(e) => setFormName(e.target.value)}
          placeholder="Örnek: CNC Freze 3"
          className="h-12"
          data-testid="input-machine-name"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Tezgah Kodu *</label>
        <Input
          value={formCode}
          onChange={(e) => setFormCode(e.target.value)}
          placeholder="Örnek: CNC-3"
          className="h-12"
          data-testid="input-machine-code"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Saatlik Maliyet (€)</label>
        <Input
          type="number"
          min="0"
          step="0.01"
          value={formHourlyCost}
          onChange={(e) => setFormHourlyCost(e.target.value)}
          placeholder="0"
          className="h-12"
          data-testid="input-machine-hourly-cost"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Tezgah Resmi</label>
        <div className="flex gap-2">
          <input
            ref={imageInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={handleImageUpload}
            data-testid="input-machine-image-file"
          />
          <Button
            type="button"
            variant="outline"
            className="h-12 flex-1"
            onClick={() => imageInputRef.current?.click()}
            disabled={isUploading}
            data-testid="button-upload-machine-image"
          >
            {isUploading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Yükleniyor...</>
            ) : (
              <><Upload className="w-4 h-4 mr-2" />Resim Yükle</>
            )}
          </Button>
        </div>
        <Input
          value={formImageUrl}
          onChange={(e) => setFormImageUrl(e.target.value)}
          placeholder="veya resim URL'si yapıştırın"
          className="h-10 text-sm"
          data-testid="input-machine-image-url"
        />
        {formImageUrl && (
          <div className="mt-2 rounded-lg border border-border overflow-hidden">
            <img
              src={formImageUrl}
              alt="Tezgah önizleme"
              className="w-full h-40 object-contain bg-muted/30"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              data-testid="img-machine-preview"
            />
          </div>
        )}
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Açıklama</label>
        <Textarea
          value={formDescription}
          onChange={(e) => setFormDescription(e.target.value)}
          placeholder="Tezgah hakkında kısa açıklama..."
          rows={3}
          data-testid="input-machine-description"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Yapabilecegi Operasyonlar</label>
        <div className="space-y-2 p-3 bg-muted/50 rounded-md max-h-48 overflow-y-auto">
          {operations?.map((op) => (
            <label
              key={op.id}
              className="flex items-center gap-3 cursor-pointer p-2 rounded-md hover:bg-muted transition-colors"
            >
              <Checkbox
                checked={formOps.includes(op.id)}
                onCheckedChange={() => toggleOp(op.id)}
                data-testid={`checkbox-op-${op.id}`}
              />
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="font-mono text-xs">{op.code}</Badge>
                <span className="text-sm">{op.name}</span>
              </div>
            </label>
          ))}
        </div>
      </div>
      <DialogFooter>
        <Button
          className="w-full h-12"
          onClick={onSubmit}
          disabled={!formName || !formCode || isPending}
          data-testid="button-save-machine"
        >
          <Save className="w-4 h-4 mr-2" />
          {isPending ? "Kaydediliyor..." : "Kaydet"}
        </Button>
      </DialogFooter>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Settings2 className="w-5 h-5 text-muted-foreground" />
          Tezgah Yönetimi
        </h2>
        <Button onClick={openAdd} data-testid="button-add-machine">
          <Plus className="w-4 h-4 mr-2" />
          Yeni Tezgah
        </Button>
      </div>

      {machines?.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Cog className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">Henuz tezgah eklenmemis.</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {machines?.map((machine, index) => {
          const statusColor =
            machine.status === "running"
              ? "text-emerald-500"
              : machine.status === "stopped" || machine.status === "broken"
              ? "text-red-500"
              : "text-muted-foreground";

          const statusLabel =
            machine.status === "running"
              ? "Çalışıyor"
              : machine.status === "idle"
              ? "Boşta"
              : machine.status === "broken"
              ? "Arızalı"
              : "Durdu";

          return (
            <Card key={machine.id} data-testid={`card-manage-machine-${machine.id}`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      disabled={index === 0}
                      onClick={() => moveMachine(index, "up")}
                      data-testid={`button-move-up-machine-${machine.id}`}
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      disabled={index === (machines?.length || 0) - 1}
                      onClick={() => moveMachine(index, "down")}
                      data-testid={`button-move-down-machine-${machine.id}`}
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  {machine.imageUrl ? (
                    <img
                      src={machine.imageUrl}
                      alt={machine.name}
                      className="w-20 h-20 rounded-lg object-cover border border-border shrink-0"
                      data-testid={`img-machine-${machine.id}`}
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center shrink-0 border border-border">
                      <ImageIcon className="w-8 h-8 text-muted-foreground/40" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm">{machine.code}</span>
                      <Badge variant="outline" className={`text-xs ${statusColor}`}>
                        {statusLabel}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{machine.name}</p>
                    {machine.description && (
                      <p className="text-xs text-muted-foreground/70 truncate mt-0.5">{machine.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground font-mono mt-1" data-testid={`text-machine-cost-${machine.id}`}>
                      {parseFloat(machine.hourlyCost || "0").toLocaleString("tr-TR")} €/saat
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(machine)}
                      data-testid={`button-edit-machine-${machine.id}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteMachine(machine)}
                      data-testid={`button-delete-machine-${machine.id}`}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Yeni Tezgah Ekle
            </DialogTitle>
            <DialogDescription>Yeni bir tezgah tanımlayın ve yapabileceği operasyonları seçin.</DialogDescription>
          </DialogHeader>
          {machineFormContent(() => createMutation.mutate(), createMutation.isPending)}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editMachine} onOpenChange={(open) => !open && setEditMachine(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5" />
              Tezgah Düzenle
            </DialogTitle>
            <DialogDescription>Tezgah bilgilerini ve operasyon yetkilerini güncelleyin.</DialogDescription>
          </DialogHeader>
          {machineFormContent(() => updateMutation.mutate(), updateMutation.isPending)}
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteMachine} onOpenChange={(open) => !open && setDeleteMachine(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-destructive" />
              Tezgahı Sil
            </DialogTitle>
            <DialogDescription>Bu işlem geri alınamaz.</DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{deleteMachine?.code} - {deleteMachine?.name}</span> tezgahını silmek istediğinizden emin misiniz?
          </p>
          <DialogFooter className="gap-2">
            <Button variant="secondary" onClick={() => setDeleteMachine(null)}>
              İptal
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMachine && deleteMutation.mutate(deleteMachine.id)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete-machine"
            >
              Sil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
