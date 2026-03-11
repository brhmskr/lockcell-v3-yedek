import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Wallet, Calendar, DollarSign } from "lucide-react";
import type { RecurringExpense, MonthlyExpense } from "@shared/schema";

const MONTH_NAMES = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

export default function ExpenseManagement() {
  const { toast } = useToast();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editExpense, setEditExpense] = useState<RecurringExpense | null>(null);
  const [deleteExpense, setDeleteExpense] = useState<RecurringExpense | null>(null);

  const [formName, setFormName] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formMonths, setFormMonths] = useState<string[]>([]);
  const [formActive, setFormActive] = useState(true);

  const { data: recurringExpenses, isLoading } = useQuery<RecurringExpense[]>({
    queryKey: ["/api/recurring-expenses"],
  });
  const { data: monthlyExpenses } = useQuery<MonthlyExpense[]>({
    queryKey: ["/api/monthly-expenses"],
  });

  const toggleMonth = (month: string) => {
    setFormMonths(prev =>
      prev.includes(month) ? prev.filter(m => m !== month) : [...prev, month]
    );
  };

  const selectAllMonths = () => {
    setFormMonths(["1","2","3","4","5","6","7","8","9","10","11","12"]);
  };

  const clearAllMonths = () => {
    setFormMonths([]);
  };

  const openAdd = () => {
    setFormName("");
    setFormAmount("");
    setFormMonths(["1","2","3","4","5","6","7","8","9","10","11","12"]);
    setFormActive(true);
    setShowAddModal(true);
  };

  const openEdit = (expense: RecurringExpense) => {
    setFormName(expense.expenseName);
    setFormAmount(expense.monthlyAmount);
    setFormMonths((expense.months as string[]) || []);
    setFormActive(expense.isActive);
    setEditExpense(expense);
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/recurring-expenses", {
        expenseName: formName,
        monthlyAmount: formAmount,
        months: formMonths,
        isActive: formActive,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recurring-expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/monthly-expenses"] });
      setShowAddModal(false);
      toast({ title: "Yıllık gider eklendi" });
    },
    onError: (err: Error) => {
      toast({ title: "Hata", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editExpense) return;
      await apiRequest("PATCH", `/api/recurring-expenses/${editExpense.id}`, {
        expenseName: formName,
        monthlyAmount: formAmount,
        months: formMonths,
        isActive: formActive,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recurring-expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/monthly-expenses"] });
      setEditExpense(null);
      toast({ title: "Gider güncellendi" });
    },
    onError: (err: Error) => {
      toast({ title: "Hata", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!deleteExpense) return;
      await apiRequest("DELETE", `/api/recurring-expenses/${deleteExpense.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recurring-expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/monthly-expenses"] });
      setDeleteExpense(null);
      toast({ title: "Gider silindi" });
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

  const totalYearly = (recurringExpenses || []).reduce((sum, r) => {
    if (!r.isActive) return sum;
    const months = (r.months as string[]) || [];
    return sum + (parseFloat(r.monthlyAmount) * months.length);
  }, 0);

  const totalMonthlyAvg = (recurringExpenses || []).reduce((sum, r) => {
    if (!r.isActive) return sum;
    return sum + parseFloat(r.monthlyAmount);
  }, 0);

  const currentMonth = new Date().getMonth() + 1;
  const currentMonthTotal = (recurringExpenses || []).reduce((sum, r) => {
    if (!r.isActive) return sum;
    const months = (r.months as string[]) || [];
    if (months.includes(String(currentMonth))) {
      return sum + parseFloat(r.monthlyAmount);
    }
    return sum;
  }, 0);

  const formContent = (
    <div className="space-y-4 py-2">
      <div className="space-y-2">
        <label className="text-sm font-medium">Gider Adı</label>
        <Input
          value={formName}
          onChange={(e) => setFormName(e.target.value)}
          placeholder="örn: Kira, Elektrik, Sigorta, Bakım"
          data-testid="input-recurring-name"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Aylık Tutar (TL)</label>
        <Input
          type="number"
          min="0"
          step="0.01"
          value={formAmount}
          onChange={(e) => setFormAmount(e.target.value)}
          placeholder="0.00"
          data-testid="input-recurring-amount"
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Gecerli Aylar</label>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="sm" className="text-xs h-7" onClick={selectAllMonths} data-testid="button-select-all-months">
              Tumunu Sec
            </Button>
            <Button type="button" variant="ghost" size="sm" className="text-xs h-7" onClick={clearAllMonths} data-testid="button-clear-months">
              Temizle
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {MONTH_NAMES.map((name, idx) => {
            const monthVal = String(idx + 1);
            const isChecked = formMonths.includes(monthVal);
            return (
              <label
                key={monthVal}
                className={`flex items-center gap-2 p-2 rounded-md border cursor-pointer transition-colors ${
                  isChecked ? "bg-primary/10 border-primary/30" : "border-border hover:bg-muted/50"
                }`}
                data-testid={`checkbox-month-${monthVal}`}
              >
                <Checkbox
                  checked={isChecked}
                  onCheckedChange={() => toggleMonth(monthVal)}
                />
                <span className="text-sm">{name}</span>
              </label>
            );
          })}
        </div>
      </div>
      <div className="flex items-center justify-between p-3 rounded-md bg-muted/30 border border-border/50">
        <label className="text-sm font-medium">Aktif</label>
        <Switch
          checked={formActive}
          onCheckedChange={setFormActive}
          data-testid="switch-recurring-active"
        />
      </div>
      {formAmount && formMonths.length > 0 && (
        <div className="p-3 rounded-md bg-primary/5 border border-primary/20" data-testid="text-yearly-preview">
          <div className="text-sm">
            <span className="text-muted-foreground">Yıllık Toplam: </span>
            <strong className="text-primary">
              {(parseFloat(formAmount) * formMonths.length).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL
            </strong>
            <span className="text-xs text-muted-foreground ml-2">
              ({formMonths.length} ay x {parseFloat(formAmount).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL)
            </span>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Wallet className="w-5 h-5" />
            Yıllık Gider Yönetimi
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Tekrarlayan giderleri tanımlayın, seçilen aylara otomatik kayıt oluşturulsun.
          </p>
        </div>
        <Button onClick={openAdd} className="gap-2" data-testid="button-add-recurring">
          <Plus className="w-4 h-4" />
          Yeni Yıllık Gider Ekle
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Bu Ay ({MONTH_NAMES[currentMonth - 1]})</p>
                <p className="font-mono font-bold text-lg" data-testid="text-current-month-total">
                  {currentMonthTotal.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Aylık Ortalama</p>
                <p className="font-mono font-bold text-lg" data-testid="text-monthly-avg">
                  {totalMonthlyAvg.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Yıllık Toplam</p>
                <p className="font-mono font-bold text-lg" data-testid="text-yearly-total">
                  {totalYearly.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {(!recurringExpenses || recurringExpenses.length === 0) ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <Wallet className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">Henüz yıllık gider tanımlanmamış.</p>
            <Button variant="outline" className="mt-4 gap-2" onClick={openAdd} data-testid="button-add-recurring-empty">
              <Plus className="w-4 h-4" />
              İlk gideri ekle
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="table-recurring-expenses">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left p-3 font-semibold">Gider Adı</th>
                <th className="text-right p-3 font-semibold">Aylık Tutar</th>
                <th className="text-left p-3 font-semibold">Uygulanan Aylar</th>
                <th className="text-right p-3 font-semibold">Yıllık Toplam</th>
                <th className="text-center p-3 font-semibold">Durum</th>
                <th className="text-right p-3 font-semibold">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {recurringExpenses.map((expense) => {
                const months = (expense.months as string[]) || [];
                const yearlyTotal = parseFloat(expense.monthlyAmount) * months.length;
                return (
                  <tr key={expense.id} className="border-b border-border/30 hover:bg-muted/30 transition-colors" data-testid={`row-recurring-${expense.id}`}>
                    <td className="p-3 font-medium">{expense.expenseName}</td>
                    <td className="p-3 text-right font-mono">
                      {parseFloat(expense.monthlyAmount).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {months
                          .sort((a, b) => parseInt(a) - parseInt(b))
                          .map(m => (
                            <Badge
                              key={m}
                              variant="secondary"
                              className="text-xs px-1.5 py-0.5"
                            >
                              {MONTH_NAMES[parseInt(m) - 1]?.substring(0, 3)}
                            </Badge>
                          ))
                        }
                      </div>
                    </td>
                    <td className="p-3 text-right font-mono font-bold">
                      {yearlyTotal.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL
                    </td>
                    <td className="p-3 text-center">
                      <Badge variant={expense.isActive ? "default" : "secondary"} className="text-xs">
                        {expense.isActive ? "Aktif" : "Pasif"}
                      </Badge>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(expense)} data-testid={`button-edit-recurring-${expense.id}`}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteExpense(expense)} data-testid={`button-delete-recurring-${expense.id}`}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Yeni Yıllık Gider Ekle
            </DialogTitle>
            <DialogDescription>
              Tekrarlayan gider tanımlayarak seçilen aylara otomatik kayıt oluşturun.
            </DialogDescription>
          </DialogHeader>
          {formContent}
          <DialogFooter>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!formName || !formAmount || formMonths.length === 0 || createMutation.isPending}
              className="w-full gap-2"
              data-testid="button-save-recurring"
            >
              {createMutation.isPending ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editExpense} onOpenChange={(open) => { if (!open) setEditExpense(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5" />
              Gider Düzenle
            </DialogTitle>
            <DialogDescription>
              Gider bilgilerini güncelleyin. Aylık kayıtlar otomatik yeniden oluşturulacak.
            </DialogDescription>
          </DialogHeader>
          {formContent}
          <DialogFooter>
            <Button
              onClick={() => updateMutation.mutate()}
              disabled={!formName || !formAmount || formMonths.length === 0 || updateMutation.isPending}
              className="w-full gap-2"
              data-testid="button-update-recurring"
            >
              {updateMutation.isPending ? "Güncelleniyor..." : "Güncelle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteExpense} onOpenChange={(open) => { if (!open) setDeleteExpense(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-5 h-5" />
              Gideri Sil
            </DialogTitle>
            <DialogDescription>
              "{deleteExpense?.expenseName}" giderini silmek istediğinize emin misiniz? İlişkili tüm aylık kayıtlar da silinecektir.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteExpense(null)} data-testid="button-cancel-delete">
              İptal
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete-recurring"
            >
              {deleteMutation.isPending ? "Siliniyor..." : "Sil"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
