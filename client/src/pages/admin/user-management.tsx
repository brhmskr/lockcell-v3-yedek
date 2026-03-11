import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Pencil, Trash2, Users, Save, Shield, Wrench,
} from "lucide-react";
import type { User } from "@shared/schema";

export default function UserManagement() {
  const { toast } = useToast();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [deleteUser, setDeleteUser] = useState<User | null>(null);

  const [formFullName, setFormFullName] = useState("");
  const [formUsername, setFormUsername] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRole, setFormRole] = useState<"admin" | "operator">("operator");
  const [formRegistrationNumber, setFormRegistrationNumber] = useState("");

  const { data: users, isLoading } = useQuery<User[]>({ queryKey: ["/api/users"] });

  const openAdd = () => {
    setFormFullName("");
    setFormUsername("");
    setFormPassword("");
    setFormRole("operator");
    setFormRegistrationNumber("");
    setShowAddModal(true);
  };

  const openEdit = (user: User) => {
    setFormFullName(user.fullName);
    setFormUsername(user.username);
    setFormPassword("");
    setFormRole(user.role as "admin" | "operator");
    setFormRegistrationNumber(user.registrationNumber || "");
    setEditUser(user);
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/users", {
        fullName: formFullName,
        username: formUsername,
        password: formPassword,
        role: formRole,
        registrationNumber: formRegistrationNumber || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setShowAddModal(false);
      toast({ title: "Personel eklendi" });
    },
    onError: (err: Error) => {
      toast({ title: "Hata", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editUser) return;
      const data: Record<string, any> = {
        fullName: formFullName,
        role: formRole,
        registrationNumber: formRegistrationNumber || null,
      };
      if (formPassword) data.password = formPassword;
      await apiRequest("PATCH", `/api/users/${editUser.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setEditUser(null);
      toast({ title: "Personel güncellendi" });
    },
    onError: (err: Error) => {
      toast({ title: "Hata", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setDeleteUser(null);
      toast({ title: "Personel silindi" });
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

  const userFormContent = (isEdit: boolean, onSubmit: () => void, isPending: boolean) => (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Ad Soyad</label>
        <Input
          value={formFullName}
          onChange={(e) => setFormFullName(e.target.value)}
          placeholder="Örnek: Ahmet Yılmaz"
          className="h-12"
          data-testid="input-user-fullname"
        />
      </div>
      {!isEdit && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Kullanıcı Adı</label>
          <Input
            value={formUsername}
            onChange={(e) => setFormUsername(e.target.value)}
            placeholder="Örnek: ahmet"
            className="h-12"
            data-testid="input-user-username"
          />
        </div>
      )}
      <div className="space-y-2">
        <label className="text-sm font-medium">
          {isEdit ? "Yeni Şifre (boş bırakılırsa değişmez)" : "Şifre"}
        </label>
        <Input
          type="password"
          value={formPassword}
          onChange={(e) => setFormPassword(e.target.value)}
          placeholder={isEdit ? "Değiştirmek için yeni şifre girin" : "Şifre giriniz"}
          className="h-12"
          data-testid="input-user-password"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Sicil No <span className="text-muted-foreground font-normal">(opsiyonel)</span></label>
        <Input
          value={formRegistrationNumber}
          onChange={(e) => setFormRegistrationNumber(e.target.value.toUpperCase())}
          placeholder="Örnek: SN-001"
          maxLength={20}
          className="h-12 font-mono"
          data-testid="input-user-registration-number"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Rol / Yetki</label>
        <Select value={formRole} onValueChange={(v) => setFormRole(v as "admin" | "operator")}>
          <SelectTrigger className="h-12" data-testid="select-user-role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="operator">
              <div className="flex items-center gap-2">
                <Wrench className="w-4 h-4 text-chart-2" />
                Operatör
              </div>
            </SelectItem>
            <SelectItem value="admin">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-chart-4" />
                Yönetici
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
      <DialogFooter>
        <Button
          className="w-full h-12"
          onClick={onSubmit}
          disabled={!formFullName || (!isEdit && (!formUsername || !formPassword)) || isPending}
          data-testid="button-save-user"
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
          <Users className="w-5 h-5 text-muted-foreground" />
          Personel Yönetimi
        </h2>
        <Button onClick={openAdd} data-testid="button-add-user">
          <Plus className="w-4 h-4 mr-2" />
          Yeni Personel
        </Button>
      </div>

      {users?.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">Henüz personel eklenmemiş.</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {users?.map((user) => (
          <Card key={user.id} data-testid={`card-manage-user-${user.id}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{user.fullName}</span>
                    <Badge
                      variant={user.role === "admin" ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {user.role === "admin" ? (
                        <><Shield className="w-3 h-3 mr-1" />Yönetici</>
                      ) : (
                        <><Wrench className="w-3 h-3 mr-1" />Operator</>
                      )}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">@{user.username}</p>
                  {user.registrationNumber && (
                    <p className="text-xs font-mono text-muted-foreground">Sicil: {user.registrationNumber}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEdit(user)}
                    data-testid={`button-edit-user-${user.id}`}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteUser(user)}
                    data-testid={`button-delete-user-${user.id}`}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Yeni Personel Ekle
            </DialogTitle>
            <DialogDescription>Sisteme yeni bir operatör veya yönetici ekleyin.</DialogDescription>
          </DialogHeader>
          {userFormContent(false, () => createMutation.mutate(), createMutation.isPending)}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editUser} onOpenChange={(open) => !open && setEditUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5" />
              Personel Düzenle
            </DialogTitle>
            <DialogDescription>Personel bilgilerini ve yetkilerini güncelleyin.</DialogDescription>
          </DialogHeader>
          {userFormContent(true, () => updateMutation.mutate(), updateMutation.isPending)}
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteUser} onOpenChange={(open) => !open && setDeleteUser(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-destructive" />
              Personeli Sil
            </DialogTitle>
            <DialogDescription>Bu işlem geri alınamaz.</DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{deleteUser?.fullName}</span> personelini silmek istediğinizden emin misiniz?
          </p>
          <DialogFooter className="gap-2">
            <Button variant="secondary" onClick={() => setDeleteUser(null)}>
              İptal
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteUser && deleteMutation.mutate(deleteUser.id)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete-user"
            >
              Sil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
