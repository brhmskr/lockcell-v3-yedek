import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Settings2, Shield, ShieldCheck, Users, Building2, Phone,
  Mail, Globe, Upload, Save, ImageOff, Eye, MapPin,
} from "lucide-react";
import type { PagePermission, User, SystemSettings } from "@shared/schema";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const PAGE_LABELS: Record<string, string> = {
  overview: "Genel Bakış",
  chat: "Tezgah Chat",
  machines: "Tezgahlar",
  operations: "Operasyonlar",
  users: "Personel",
  assignments: "Operatör Atamaları",
  workorders: "İş Emirleri",
  stopreasons: "Duruş Nedenleri",
  expenses: "Giderler",
  reports: "Raporlar",
  efficiency: "Verimlilik",
  profitability: "Kârlılık",
  settings: "Ayarlar",
};

const ROLE_LABELS: Record<string, string> = {
  superadmin: "Süper Admin",
  manager: "Yönetici",
  staff: "Personel",
};

const ROLE_COLORS: Record<string, string> = {
  superadmin: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30",
  manager: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
  staff: "bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/30",
};

function CompanySettingsSection() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: settings, isLoading } = useQuery<SystemSettings>({
    queryKey: ["/api/system-settings"],
  });

  const [form, setForm] = useState({
    companyName: "",
    companyLogo: "",
    address: "",
    phone: "",
    email: "",
    webSite: "",
  });

  const [initialized, setInitialized] = useState(false);
  if (settings && !initialized) {
    setForm({
      companyName: settings.companyName || "",
      companyLogo: settings.companyLogo || "",
      address: settings.address || "",
      phone: settings.phone || "",
      email: settings.email || "",
      webSite: settings.webSite || "",
    });
    setInitialized(true);
  }

  const saveMutation = useMutation({
    mutationFn: () => apiRequest("PUT", "/api/system-settings", form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/system-settings"] });
      toast({ title: "Firma ayarları kaydedildi" });
    },
    onError: () => {
      toast({ title: "Hata", description: "Ayarlar kaydedilemedi", variant: "destructive" });
    },
  });

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Dosya çok büyük", description: "Logo en fazla 2 MB olabilir.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setForm(f => ({ ...f, companyLogo: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  const logoSrc = form.companyLogo || null;

  return (
    <div className="space-y-6">
      <Card data-testid="card-company-settings">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="w-4 h-4 text-muted-foreground" />
            Firma Bilgileri
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                Firma Adı
              </label>
              <Input
                value={form.companyName}
                onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))}
                placeholder="LOCKCELL MES"
                data-testid="input-company-name"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                Telefon
              </label>
              <Input
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="+90 212 000 00 00"
                data-testid="input-company-phone"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                E-posta
              </label>
              <Input
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="info@firma.com"
                data-testid="input-company-email"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-1">
                <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                Web Sitesi
              </label>
              <Input
                value={form.webSite}
                onChange={e => setForm(f => ({ ...f, webSite: e.target.value }))}
                placeholder="www.firma.com"
                data-testid="input-company-website"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                Adres
              </label>
              <Textarea
                value={form.address}
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                placeholder="Fabrika adresi..."
                rows={2}
                data-testid="input-company-address"
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <label className="text-sm font-medium flex items-center gap-1">
              <Upload className="w-3.5 h-3.5 text-muted-foreground" />
              Firma Logosu
            </label>
            <div className="flex items-center gap-3">
              <div className="w-20 h-20 border-2 border-dashed rounded-lg flex items-center justify-center bg-muted/30" data-testid="preview-logo-thumbnail">
                {logoSrc ? (
                  <img src={logoSrc} alt="Logo" className="w-full h-full object-contain p-1 rounded" />
                ) : (
                  <ImageOff className="w-8 h-8 text-muted-foreground/40" />
                )}
              </div>
              <div className="space-y-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  className="hidden"
                  onChange={handleLogoUpload}
                  data-testid="input-logo-file"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  data-testid="button-upload-logo"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Logo Yükle
                </Button>
                {logoSrc && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setForm(f => ({ ...f, companyLogo: "" }))}
                    data-testid="button-remove-logo"
                  >
                    Logoyu Kaldır
                  </Button>
                )}
                <p className="text-xs text-muted-foreground">PNG, JPEG, SVG — maks. 2 MB</p>
                <p className="text-xs text-muted-foreground">Veritabanında Base64 olarak saklanır</p>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !form.companyName}
              data-testid="button-save-company-settings"
            >
              <Save className="w-4 h-4 mr-2" />
              {saveMutation.isPending ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-report-preview">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Eye className="w-4 h-4 text-muted-foreground" />
            Canlı Önizleme — Rapor Başlığı
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border-2 border-dashed border-muted rounded-lg p-4 bg-white dark:bg-gray-950">
            <div className="border border-gray-300 dark:border-gray-700 rounded p-4 text-sm">
              <div className="flex items-start justify-between border-b border-gray-200 dark:border-gray-700 pb-3 mb-3">
                <div className="flex items-center gap-3">
                  {logoSrc ? (
                    <img src={logoSrc} alt="Logo" className="h-12 w-auto object-contain" />
                  ) : (
                    <div className="h-12 w-16 bg-muted/50 rounded flex items-center justify-center border border-dashed border-muted-foreground/30">
                      <ImageOff className="w-5 h-5 text-muted-foreground/40" />
                    </div>
                  )}
                  <div>
                    <p className="font-bold text-base text-gray-900 dark:text-gray-100">{form.companyName || "Firma Adı"}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">LOCKCELL MES — Dijital Üretim Takip Sistemi</p>
                  </div>
                </div>
                <div className="text-right text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
                  <p className="font-semibold text-gray-700 dark:text-gray-300">OPERASYON PLANI</p>
                  <p>Rapor: {new Date().toLocaleDateString("tr-TR")}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-800 pt-2 mt-1">
                {form.address && <p className="flex items-center gap-1"><MapPin className="w-3 h-3 shrink-0" />{form.address}</p>}
                {form.phone && <p className="flex items-center gap-1"><Phone className="w-3 h-3 shrink-0" />{form.phone}</p>}
                {form.email && <p className="flex items-center gap-1"><Mail className="w-3 h-3 shrink-0" />{form.email}</p>}
                {form.webSite && <p className="flex items-center gap-1"><Globe className="w-3 h-3 shrink-0" />{form.webSite}</p>}
              </div>
            </div>
            <p className="text-xs text-center text-muted-foreground mt-2">PDF raporlarında bu başlık görünecektir</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SettingsPage() {
  const { toast } = useToast();
  const { data: permissions, isLoading: permsLoading } = useQuery<PagePermission[]>({
    queryKey: ["/api/page-permissions"],
  });
  const { data: allUsers, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const permMutation = useMutation({
    mutationFn: async ({ pageId, roleName, allowed }: { pageId: string; roleName: string; allowed: boolean }) => {
      await apiRequest("POST", "/api/page-permissions", { pageId, roleName, allowed });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/page-permissions"] });
    },
    onError: () => {
      toast({ title: "Hata", description: "Yetki güncellenemedi", variant: "destructive" });
    },
  });

  const roleMutation = useMutation({
    mutationFn: async ({ userId, adminRole }: { userId: number; adminRole: string }) => {
      await apiRequest("PATCH", `/api/users/${userId}/admin-role`, { adminRole });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Başarılı", description: "Kullanıcı rolü güncellendi" });
    },
    onError: () => {
      toast({ title: "Hata", description: "Rol güncellenemedi", variant: "destructive" });
    },
  });

  const isAllowed = (pageId: string, roleName: string): boolean => {
    if (!permissions) return true;
    const perm = permissions.find((p) => p.pageId === pageId && p.roleName === roleName);
    return perm ? perm.allowed : true;
  };

  const togglePermission = (pageId: string, roleName: string) => {
    if (roleName === "superadmin") return;
    const current = isAllowed(pageId, roleName);
    permMutation.mutate({ pageId, roleName, allowed: !current });
  };

  const pageIds = Object.keys(PAGE_LABELS);
  const roles = ["superadmin", "manager", "staff"];

  if (permsLoading || usersLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const adminUsers = (allUsers || []).filter((u) => u.role === "admin");

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2" data-testid="text-settings-title">
          <Settings2 className="w-5 h-5 text-muted-foreground" />
          Sistem Ayarları
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Firma kimliği, rapor görünümü ve yetki yönetimi
        </p>
      </div>

      <CompanySettingsSection />

      <Separator />

      <div>
        <h3 className="text-base font-semibold flex items-center gap-2 mb-4">
          <ShieldCheck className="w-4 h-4 text-muted-foreground" />
          Süper Admin Ayarları
        </h3>
      </div>

      <Card data-testid="card-user-roles">
        <CardContent className="p-4 space-y-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            Yönetici Rolleri
          </h3>
          <div className="space-y-2">
            {adminUsers.map((user) => (
              <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`row-user-role-${user.id}`}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                    <Shield className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{user.fullName}</p>
                    <p className="text-xs text-muted-foreground">{user.username}</p>
                  </div>
                </div>
                <Select
                  value={user.adminRole || "staff"}
                  onValueChange={(val) => roleMutation.mutate({ userId: user.id, adminRole: val })}
                  data-testid={`select-admin-role-${user.id}`}
                >
                  <SelectTrigger className="w-40" data-testid={`trigger-admin-role-${user.id}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="superadmin">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-3.5 h-3.5 text-red-500" />
                        Süper Admin
                      </div>
                    </SelectItem>
                    <SelectItem value="manager">
                      <div className="flex items-center gap-2">
                        <Shield className="w-3.5 h-3.5 text-blue-500" />
                        Yönetici
                      </div>
                    </SelectItem>
                    <SelectItem value="staff">
                      <div className="flex items-center gap-2">
                        <Users className="w-3.5 h-3.5 text-gray-500" />
                        Personel
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-page-permissions">
        <CardContent className="p-4">
          <h3 className="font-semibold flex items-center gap-2 mb-4">
            <ShieldCheck className="w-4 h-4 text-muted-foreground" />
            Sayfa Erişim Yetkileri
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 font-medium text-muted-foreground">Sayfa</th>
                  {roles.map((role) => (
                    <th key={role} className="text-center p-3 font-medium">
                      <Badge className={`text-xs ${ROLE_COLORS[role]}`} variant="outline">
                        {ROLE_LABELS[role]}
                      </Badge>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageIds.map((pageId) => (
                  <tr key={pageId} className="border-b border-border/30 hover:bg-muted/30" data-testid={`row-perm-${pageId}`}>
                    <td className="p-3 font-medium">{PAGE_LABELS[pageId]}</td>
                    {roles.map((role) => (
                      <td key={role} className="p-3 text-center">
                        <Switch
                          checked={isAllowed(pageId, role)}
                          onCheckedChange={() => togglePermission(pageId, role)}
                          disabled={role === "superadmin"}
                          data-testid={`switch-perm-${pageId}-${role}`}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
