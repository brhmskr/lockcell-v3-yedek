import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Shield, Key, Server, Copy, Phone, Mail, Building2, AlertTriangle, LogOut } from "lucide-react";

interface LicenseRenewalProps {
  isAdmin: boolean;
  onLogout: () => void;
}

export default function LicenseRenewal({ isAdmin, onLogout }: LicenseRenewalProps) {
  const { toast } = useToast();
  const [licenseKey, setLicenseKey] = useState("");
  const [expiryDate, setExpiryDate] = useState("");

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
      window.location.reload();
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

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-lg w-full space-y-6">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-foreground" data-testid="text-license-expired-title">
            Lisans Süresi Dolmuş
          </h1>
          <p className="text-muted-foreground mt-2">
            Sistemi kullanmaya devam etmek için lisansınızı yenileyin.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Server className="w-5 h-5" />
              Sunucu Bilgileri
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Input
                value={serverIdData?.serverId || ""}
                readOnly
                className="font-mono text-sm font-bold tracking-wider"
                data-testid="input-renewal-server-id"
              />
              <Button variant="outline" size="icon" onClick={copyServerId} data-testid="button-renewal-copy-id">
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Bu Server ID'yi lisans anahtarı almak için aşağıdaki iletişim bilgilerinden destek ekibine iletiniz.
            </p>
          </CardContent>
        </Card>

        {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Key className="w-5 h-5" />
                Lisans Anahtarı Gir
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Bitiş Tarihi</p>
                <Input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  data-testid="input-renewal-expiry"
                />
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Lisans Anahtarı</p>
                <Input
                  value={licenseKey}
                  onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
                  placeholder="XXXX-XXXX-XXXX-XXXX"
                  className="font-mono tracking-wider"
                  maxLength={19}
                  data-testid="input-renewal-key"
                />
              </div>
              <Button
                className="w-full"
                disabled={!licenseKey || !expiryDate || activateMutation.isPending}
                onClick={() => activateMutation.mutate({ licenseKey, expiryDate })}
                data-testid="button-renewal-activate"
              >
                {activateMutation.isPending ? "Doğrulanıyor..." : "Lisansı Aktive Et"}
              </Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="w-5 h-5" />
              Destek İletişim
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-sm">TMT Makine San. ve Tic. Ltd. Şti.</span>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-sm">Destek Hattı: +90 541 314 04 75</span>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-sm">Telefon: (0262) 502 4570</span>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-sm">E-posta: destek@tmtmakine.com.tr</span>
            </div>
          </CardContent>
        </Card>

        <Button variant="outline" className="w-full" onClick={onLogout} data-testid="button-renewal-logout">
          <LogOut className="w-4 h-4 mr-2" />
          Çıkış Yap
        </Button>
      </div>
    </div>
  );
}
