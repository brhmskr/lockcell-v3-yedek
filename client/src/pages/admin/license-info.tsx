import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Shield, Copy, CheckCircle, AlertTriangle, XCircle, Key, Calendar, Server } from "lucide-react";

interface LicenseStatus {
  status: "active" | "demo" | "grace" | "expired";
  daysRemaining: number;
  expiryDate: string | null;
  installationDate: string | null;
  serverId: string;
  message: string;
}

export default function LicenseInfoPage() {
  const { toast } = useToast();
  const [licenseKey, setLicenseKey] = useState("");
  const [expiryDate, setExpiryDate] = useState("");

  const { data: licenseStatus, isLoading: statusLoading } = useQuery<LicenseStatus>({
    queryKey: ["/api/license/status"],
  });

  const { data: serverIdData } = useQuery<{ serverId: string }>({
    queryKey: ["/api/license/server-id"],
  });

  const activateMutation = useMutation({
    mutationFn: async (data: { licenseKey: string; expiryDate: string }) => {
      const res = await apiRequest("POST", "/api/license/activate", data);
      return await res.json();
    },
    onSuccess: (data: { message: string }) => {
      toast({ title: "Başarılı", description: data.message });
      setLicenseKey("");
      setExpiryDate("");
      queryClient.invalidateQueries({ queryKey: ["/api/license/status"] });
    },
    onError: (err: Error) => {
      toast({ title: "Hata", description: err.message, variant: "destructive" });
    },
  });

  const copyServerId = () => {
    if (serverIdData?.serverId) {
      navigator.clipboard.writeText(serverIdData.serverId);
      toast({ title: "Kopyalandı", description: "Server ID panoya kopyalandı." });
    }
  };

  const statusIcon = () => {
    if (!licenseStatus) return null;
    switch (licenseStatus.status) {
      case "active": return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "demo": return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case "grace": return <AlertTriangle className="w-5 h-5 text-orange-500" />;
      case "expired": return <XCircle className="w-5 h-5 text-red-500" />;
    }
  };

  const statusBadge = () => {
    if (!licenseStatus) return null;
    const variants: Record<string, string> = {
      active: "bg-green-500/10 text-green-600 border-green-500/30",
      demo: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30",
      grace: "bg-orange-500/10 text-orange-600 border-orange-500/30",
      expired: "bg-red-500/10 text-red-600 border-red-500/30",
    };
    const labels: Record<string, string> = {
      active: "Aktif",
      demo: "Demo",
      grace: "Ek Süre",
      expired: "Süresi Dolmuş",
    };
    return (
      <Badge variant="outline" className={variants[licenseStatus.status]} data-testid="badge-license-status">
        {labels[licenseStatus.status]}
      </Badge>
    );
  };

  if (statusLoading) {
    return <div className="space-y-4"><Skeleton className="h-40 w-full" /><Skeleton className="h-40 w-full" /></div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="w-5 h-5 text-primary" />
            Lisans Durumu
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30">
              {statusIcon()}
              <div>
                <p className="text-sm text-muted-foreground">Durum</p>
                <div className="flex items-center gap-2">
                  {statusBadge()}
                  {licenseStatus && licenseStatus.daysRemaining > 0 && (
                    <span className="text-sm font-mono font-bold" data-testid="text-days-remaining">
                      {licenseStatus.daysRemaining} gün kaldı
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30">
              <Calendar className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Bitiş Tarihi</p>
                <p className="font-mono font-bold" data-testid="text-expiry-date">
                  {licenseStatus?.expiryDate
                    ? new Date(licenseStatus.expiryDate).toLocaleDateString("tr-TR")
                    : "Belirlenmemiş"}
                </p>
              </div>
            </div>
          </div>

          {licenseStatus && (
            <p className="text-sm text-muted-foreground" data-testid="text-license-message">
              {licenseStatus.message}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Server className="w-5 h-5 text-primary" />
            Sunucu Bilgileri
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-2">Server ID</p>
            <div className="flex items-center gap-2">
              <Input
                value={serverIdData?.serverId || ""}
                readOnly
                className="font-mono text-lg font-bold tracking-wider"
                data-testid="input-server-id"
              />
              <Button variant="outline" size="icon" onClick={copyServerId} data-testid="button-copy-server-id">
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Bu ID'yi lisans anahtarı almak için destek ekibine iletiniz.
            </p>
          </div>

          {licenseStatus?.installationDate && (
            <div>
              <p className="text-sm text-muted-foreground">Kurulum Tarihi</p>
              <p className="font-mono" data-testid="text-installation-date">
                {new Date(licenseStatus.installationDate).toLocaleDateString("tr-TR")}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Key className="w-5 h-5 text-primary" />
            Lisans Anahtarı Giriş
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-2">Bitiş Tarihi</p>
            <Input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              data-testid="input-license-expiry"
            />
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-2">Lisans Anahtarı (XXXX-XXXX-XXXX-XXXX)</p>
            <Input
              value={licenseKey}
              onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
              placeholder="XXXX-XXXX-XXXX-XXXX"
              className="font-mono text-lg tracking-wider"
              maxLength={19}
              data-testid="input-license-key"
            />
          </div>
          <Button
            className="w-full"
            disabled={!licenseKey || !expiryDate || activateMutation.isPending}
            onClick={() => activateMutation.mutate({ licenseKey, expiryDate })}
            data-testid="button-activate-license"
          >
            {activateMutation.isPending ? "Doğrulanıyor..." : "Lisansı Aktive Et"}
          </Button>

          <div className="border-t border-border pt-4 mt-4">
            <p className="text-sm font-semibold mb-2">Destek İletişim</p>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>TMT Makine San. ve Tic. Ltd. Şti.</p>
              <p>Destek Hattı: +90 541 314 04 75</p>
              <p>Telefon: (0262) 502 4570</p>
              <p>E-posta: destek@tmtmakine.com.tr</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
