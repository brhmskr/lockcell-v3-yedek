import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  LogIn,
  Shield,
  Wrench,
  Lock,
  User as UserIcon,
  KeyRound,
  Settings2,
} from "lucide-react";

// Dashboard'da çalışan orijinal yolları tekrar aktif ediyoruz
import lockcellLogoWhite from "@assets/lockcell-beyaz_1772012570656.webp";
import lockcellLogoDark from "@assets/lockcell_logo_1772012546609.webp";

import type { User, Machine } from "@shared/schema";

type SafeUser = Omit<User, "password">;

interface LoginPageProps {
  onLogin: (user: SafeUser, machineId?: number) => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const { toast } = useToast();
  const [mode, setMode] = useState<"admin" | "operator">("operator");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [selectedMachineId, setSelectedMachineId] = useState<string>("");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [pin, setPin] = useState("");

  const { data: operators } = useQuery<SafeUser[]>({
    queryKey: ["/api/operators"],
  });

  const { data: machines } = useQuery<
    Pick<Machine, "id" | "name" | "code" | "status">[]
  >({
    queryKey: ["/api/machines-public"],
  });

  const adminLoginMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/auth/login", {
        username,
        password,
      });
      return res.json();
    },
    onSuccess: (user: SafeUser) => {
      onLogin(user);
    },
    onError: (err: Error) => {
      toast({
        title: "Giriş Hatası",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const operatorLoginMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/auth/operator-login", {
        userId: Number(selectedUserId),
        pin,
        machineId: selectedMachineId ? Number(selectedMachineId) : undefined,
      });
      return res.json();
    },
    onSuccess: (user: SafeUser) => {
      onLogin(user, selectedMachineId ? Number(selectedMachineId) : undefined);
    },
    onError: (err: Error) => {
      toast({
        title: "Giriş Hatası",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;
    adminLoginMutation.mutate();
  };

  const handleOperatorLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMachineId || !selectedUserId || !pin) return;
    operatorLoginMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-3">
          <div className="flex flex-col items-center justify-center mb-6">
            {/* GARANTİ YÖNTEM: 
              Tarayıcıda temanın ne olduğunu anlamak için 'dark' sınıfını kontrol eden 
              ve CSS yerine manuel gösterim yapan yapıya geçtik.
            */}
            <img
              src={lockcellLogoDark}
              alt="Lockcell Logo"
              className="h-16 w-auto object-contain block dark:hidden"
              style={{ minHeight: '64px' }}
            />
            <img
              src={lockcellLogoWhite}
              alt="Lockcell Logo"
              className="h-16 w-auto object-contain hidden dark:block"
              style={{ minHeight: '64px' }}
            />
          </div>
          <h1
            className="text-2xl font-bold tracking-tight"
            data-testid="text-app-title"
          >
            MES Üretim Takip Sistemi
          </h1>
          <p className="text-muted-foreground text-sm">
            Sisteme giriş yapmak için kimlik bilgilerinizi giriniz
          </p>
        </div>

        <div className="flex rounded-lg border border-border/50 overflow-hidden">
          <button
            type="button"
            className={`flex-1 py-3 px-4 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
              mode === "operator"
                ? "bg-primary text-primary-foreground"
                : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
            }`}
            onClick={() => setMode("operator")}
          >
            <Wrench className="w-4 h-4" />
            Operatör Girişi
          </button>
          <button
            type="button"
            className={`flex-1 py-3 px-4 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
              mode === "admin"
                ? "bg-primary text-primary-foreground"
                : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
            }`}
            onClick={() => setMode("admin")}
          >
            <Shield className="w-4 h-4" />
            Yönetici Girişi
          </button>
        </div>

        {/* Form alanları değişmedi, aynen devam ediyor... */}
        {mode === "operator" && (
          <Card className="border-border/50 shadow-lg">
            <CardContent className="p-6">
              <form onSubmit={handleOperatorLogin} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                    <Settings2 className="w-4 h-4" />
                    Tezgah Seçimi
                  </label>
                  <Select
                    value={selectedMachineId}
                    onValueChange={setSelectedMachineId}
                  >
                    <SelectTrigger className="h-14 text-base">
                      <SelectValue placeholder="Tezgah seçiniz..." />
                    </SelectTrigger>
                    <SelectContent>
                      {machines?.map((m) => (
                        <SelectItem key={m.id} value={String(m.id)}>
                          <div className="flex items-center gap-2 py-1">
                            <Settings2 className="w-4 h-4 text-chart-1" />
                            <span className="font-mono font-bold text-sm">{m.code}</span>
                            <span className="text-muted-foreground">|</span>
                            <span className="text-base">{m.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                    <UserIcon className="w-4 h-4" />
                    Operatör İsmi
                  </label>
                  <Select
                    value={selectedUserId}
                    onValueChange={setSelectedUserId}
                  >
                    <SelectTrigger className="h-14 text-base">
                      <SelectValue placeholder="Operatör seçiniz..." />
                    </SelectTrigger>
                    <SelectContent>
                      {operators?.map((op) => (
                        <SelectItem key={op.id} value={String(op.id)}>
                          <div className="flex items-center gap-2 py-1">
                            <Wrench className="w-4 h-4 text-chart-2" />
                            <span className="text-base">{op.fullName}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                    <KeyRound className="w-4 h-4" />
                    PIN Kodu
                  </label>
                  <Input
                    type="password"
                    inputMode="numeric"
                    maxLength={8}
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="PIN kodunuzu giriniz..."
                    className="h-14 text-xl text-center font-mono tracking-[0.5em]"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full h-14 text-lg font-bold"
                  disabled={!selectedMachineId || !selectedUserId || !pin || operatorLoginMutation.isPending}
                >
                  {operatorLoginMutation.isPending ? "Giriş yapılıyor..." : "Giriş Yap"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {mode === "admin" && (
          <Card className="border-border/50 shadow-lg">
            <CardContent className="p-6">
              <form onSubmit={handleAdminLogin} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                    <UserIcon className="w-4 h-4" />
                    Kullanıcı Adı
                  </label>
                  <Input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Kullanıcı adınızı giriniz..."
                    className="h-14 text-base"
                    autoComplete="username"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    Şifre
                  </label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Şifrenizi giriniz..."
                    className="h-14 text-base"
                    autoComplete="current-password"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full h-14 text-lg font-bold"
                  disabled={!username || !password || adminLoginMutation.isPending}
                >
                  {adminLoginMutation.isPending ? "Giriş yapılıyor..." : "Yönetici Girişi"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        <p className="text-center text-xs text-muted-foreground">
          LOCKCELL MES v1.0
        </p>
      </div>
    </div>
  );
}