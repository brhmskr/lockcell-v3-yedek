import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from "@/components/ui/sheet";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Pencil, Trash2, Package, Save, CheckCircle, Loader2, Hourglass,
  GripVertical, ArrowUp, ArrowDown, X, Upload, Download, FileSpreadsheet,
  ImageIcon, Eye, History, FileText, Search, ChevronLeft, ChevronRight,
  Activity, Clock, ListFilter, CalendarRange,
} from "lucide-react";
import * as XLSX from "xlsx";
import type { WorkOrder, WorkOrderLine, Operation, TechnicalDrawing, Machine } from "@shared/schema";
import WorkOrderOperationsPanel from "@/pages/admin/work-order-operations";

type AugmentedWorkOrder = WorkOrder & { totalOps?: number; completedOps?: number };

function TechnicalDrawingSection({ workOrderId }: { workOrderId: number }) {
  const { toast } = useToast();
  const [showHistory, setShowHistory] = useState(false);
  const [revisionNote, setRevisionNote] = useState("");
  const [uploading, setUploading] = useState(false);
  const drawingFileRef = useRef<HTMLInputElement>(null);

  const { data: drawings = [] } = useQuery<TechnicalDrawing[]>({
    queryKey: ["/api/technical-drawings", workOrderId],
  });

  const currentDrawing = drawings.find(d => d.isCurrent);
  const oldRevisions = drawings.filter(d => !d.isCurrent);

  const handleDrawingUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const maxSize = 20 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({ title: "Dosya çok büyük", description: "Maksimum 20MB yüklenebilir", variant: "destructive" });
      if (drawingFileRef.current) drawingFileRef.current.value = "";
      return;
    }
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (!["pdf", "png", "jpg", "jpeg"].includes(ext)) {
      toast({ title: "Geçersiz dosya tipi", description: "Sadece PDF, PNG, JPG desteklenir", variant: "destructive" });
      if (drawingFileRef.current) drawingFileRef.current.value = "";
      return;
    }
    setUploading(true);
    try {
      const res = await apiRequest("POST", "/api/uploads/request-url", { name: file.name, size: file.size, contentType: file.type });
      const { uploadURL, objectPath } = await res.json();
      await fetch(uploadURL, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      const fileUrl = objectPath.startsWith("/objects/") ? objectPath : `/objects/${objectPath}`;
      await apiRequest("POST", `/api/technical-drawings/${workOrderId}`, { fileName: file.name, fileUrl, revisionNote: revisionNote || null });
      setRevisionNote("");
      queryClient.invalidateQueries({ queryKey: ["/api/technical-drawings", workOrderId] });
      toast({ title: currentDrawing ? "Yeni revizyon yüklendi" : "Teknik resim yüklendi" });
    } catch {
      toast({ title: "Dosya yüklenemedi", variant: "destructive" });
    } finally {
      setUploading(false);
      if (drawingFileRef.current) drawingFileRef.current.value = "";
    }
  };

  const isImage = (name: string) => ["jpg", "jpeg", "png", "gif", "webp"].includes(name.split(".").pop()?.toLowerCase() || "");

  return (
    <div className="space-y-2" data-testid={`section-drawing-${workOrderId}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
          <ImageIcon className="w-3.5 h-3.5" />
          Teknik Resim
          {currentDrawing && <Badge variant="secondary" className="text-[10px] px-1.5">Rev.{currentDrawing.revisionNumber}</Badge>}
        </span>
        {oldRevisions.length > 0 && (
          <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] gap-1" onClick={() => setShowHistory(!showHistory)} data-testid={`button-drawing-history-${workOrderId}`}>
            <History className="w-3 h-3" />
            Geçmiş ({oldRevisions.length})
          </Button>
        )}
      </div>
      {currentDrawing && (
        <div className="flex items-center gap-3 p-2 bg-muted/40 rounded-md">
          {isImage(currentDrawing.fileName) ? (
            <a href={currentDrawing.fileUrl} target="_blank" rel="noopener noreferrer">
              <img src={currentDrawing.fileUrl} alt={currentDrawing.fileName} className="w-16 h-16 rounded object-cover border border-border/50" data-testid={`img-drawing-preview-${workOrderId}`} />
            </a>
          ) : (
            <a href={currentDrawing.fileUrl} target="_blank" rel="noopener noreferrer" className="w-16 h-16 rounded bg-red-500/10 flex items-center justify-center border border-border/50">
              <FileText className="w-8 h-8 text-red-500" />
            </a>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{currentDrawing.fileName}</p>
            <p className="text-[10px] text-muted-foreground">Rev.{currentDrawing.revisionNumber} - {currentDrawing.revisionDate ? new Date(currentDrawing.revisionDate).toLocaleDateString("tr-TR") : ""}</p>
            {currentDrawing.revisionNote && <p className="text-[10px] text-muted-foreground italic truncate">{currentDrawing.revisionNote}</p>}
          </div>
          <a href={currentDrawing.fileUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="h-7 gap-1 text-[10px]" data-testid={`button-view-drawing-${workOrderId}`}><Eye className="w-3 h-3" /> Aç</Button>
          </a>
        </div>
      )}
      {showHistory && oldRevisions.length > 0 && (
        <div className="space-y-1 pl-2 border-l-2 border-muted">
          {oldRevisions.map((d) => (
            <div key={d.id} className="flex items-center gap-2 text-[10px] text-muted-foreground py-1">
              <Badge variant="outline" className="text-[9px] px-1 shrink-0">Rev.{d.revisionNumber}</Badge>
              <span className="truncate">{d.fileName}</span>
              <span className="shrink-0">{d.revisionDate ? new Date(d.revisionDate).toLocaleDateString("tr-TR") : ""}</span>
              <a href={d.fileUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 underline hover:text-foreground">Aç</a>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <input ref={drawingFileRef} type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg" onChange={handleDrawingUpload} data-testid={`input-drawing-file-${workOrderId}`} />
        {currentDrawing && (
          <Input value={revisionNote} onChange={(e) => setRevisionNote(e.target.value)} placeholder="Revizyon notu (opsiyonel)..." className="flex-1 h-7 text-xs" data-testid={`input-revision-note-${workOrderId}`} />
        )}
        <Button variant="outline" size="sm" className="h-7 gap-1 text-[10px] shrink-0" onClick={() => drawingFileRef.current?.click()} disabled={uploading} data-testid={`button-upload-drawing-${workOrderId}`}>
          {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
          {currentDrawing ? "Yeni Revizyon" : "Teknik Resim Yükle"}
        </Button>
      </div>
    </div>
  );
}

const PAGE_SIZE = 12;

export default function WorkOrderManagement({ isSuperAdmin = true }: { isSuperAdmin?: boolean }) {
  const { toast } = useToast();

  const [showAddModal, setShowAddModal] = useState(false);
  const [editWo, setEditWo] = useState<WorkOrder | null>(null);
  const [deleteWo, setDeleteWo] = useState<WorkOrder | null>(null);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkRows, setBulkRows] = useState<any[]>([]);
  const [bulkErrors, setBulkErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formOrderNumber, setFormOrderNumber] = useState("");
  const [formProductName, setFormProductName] = useState("");
  const [formTargetQty, setFormTargetQty] = useState("");
  const [formTargetPrice, setFormTargetPrice] = useState("0");
  const [formMaterialCost, setFormMaterialCost] = useState("0");
  const [formToolCost, setFormToolCost] = useState("0");
  const [formCostCurrency, setFormCostCurrency] = useState("EUR");
  const [formRoute, setFormRoute] = useState<number[]>([]);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);

  const [detailWo, setDetailWo] = useState<AugmentedWorkOrder | null>(null);

  const { data: operations } = useQuery<Operation[]>({ queryKey: ["/api/operations"] });
  const { data: machines = [] } = useQuery<Machine[]>({ queryKey: ["/api/machines"] });
  const { data: workOrderLines } = useQuery<WorkOrderLine[]>({ queryKey: ["/api/work-order-lines"] });

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); }, [debouncedSearch, statusFilter, startDate, endDate]);

  const queryParams = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  if (debouncedSearch) queryParams.set("search", debouncedSearch);
  if (statusFilter !== "all") queryParams.set("status", statusFilter);
  if (startDate) queryParams.set("startDate", startDate);
  if (endDate) queryParams.set("endDate", endDate);

  const { data: woData, isLoading } = useQuery<{ data: AugmentedWorkOrder[]; total: number; stats: { active: number; pending: number; completed: number } }>({
    queryKey: ["/api/work-orders", "paginated", page, debouncedSearch, statusFilter, startDate, endDate],
    queryFn: () => fetch(`/api/work-orders?${queryParams}`, { credentials: "include" }).then(r => r.json()),
    refetchInterval: 10000,
  });

  const workOrders = woData?.data ?? [];
  const total = woData?.total ?? 0;
  const stats = woData?.stats ?? { active: 0, pending: 0, completed: 0 };
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const invalidateWO = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] });
    queryClient.invalidateQueries({ queryKey: ["/api/work-order-lines"] });
  };

  const openAdd = () => {
    setFormOrderNumber(""); setFormProductName(""); setFormTargetQty(""); setFormTargetPrice("0");
    setFormMaterialCost("0"); setFormToolCost("0"); setFormCostCurrency("EUR"); setFormRoute([]);
    setShowAddModal(true);
  };

  const openEdit = (wo: WorkOrder) => {
    setFormOrderNumber(wo.orderNumber); setFormProductName(wo.productName);
    setFormTargetQty(String(wo.targetQuantity)); setFormTargetPrice(wo.targetPrice || "0");
    setFormRoute(wo.operationRoute || []);
    const woLine = workOrderLines?.find(l => l.workOrderId === wo.id);
    setFormMaterialCost(woLine?.materialCostPerUnit || "0");
    setFormToolCost(woLine?.toolCostPerUnit || "0");
    setFormCostCurrency(woLine?.costCurrency || "EUR");
    setEditWo(wo);
  };

  const addToRoute = (opId: number) => setFormRoute(prev => [...prev, opId]);
  const removeFromRoute = (index: number) => setFormRoute(prev => prev.filter((_, i) => i !== index));
  const moveUp = (index: number) => {
    if (index === 0) return;
    setFormRoute(prev => { const a = [...prev]; [a[index - 1], a[index]] = [a[index], a[index - 1]]; return a; });
  };
  const moveDown = (index: number) => {
    if (index >= formRoute.length - 1) return;
    setFormRoute(prev => { const a = [...prev]; [a[index], a[index + 1]] = [a[index + 1], a[index]]; return a; });
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/work-orders", {
        orderNumber: formOrderNumber, productName: formProductName,
        targetQuantity: parseInt(formTargetQty), targetPrice: formTargetPrice,
        operationRoute: formRoute, materialCostPerUnit: formMaterialCost,
        toolCostPerUnit: formToolCost, costCurrency: formCostCurrency,
      });
    },
    onSuccess: () => { invalidateWO(); setShowAddModal(false); toast({ title: "İş emri oluşturuldu" }); },
    onError: (err: Error) => { toast({ title: "Hata", description: err.message, variant: "destructive" }); },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editWo) return;
      await apiRequest("PATCH", `/api/work-orders/${editWo.id}`, {
        orderNumber: formOrderNumber, productName: formProductName,
        targetQuantity: parseInt(formTargetQty), targetPrice: formTargetPrice,
        operationRoute: formRoute, materialCostPerUnit: formMaterialCost,
        toolCostPerUnit: formToolCost, costCurrency: formCostCurrency,
      });
    },
    onSuccess: () => { invalidateWO(); setEditWo(null); toast({ title: "İş emri güncellendi" }); },
    onError: (err: Error) => { toast({ title: "Hata", description: err.message, variant: "destructive" }); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/work-orders/${id}`); },
    onSuccess: () => { invalidateWO(); setDeleteWo(null); toast({ title: "İş emri silindi" }); },
    onError: (err: Error) => { toast({ title: "Hata", description: err.message, variant: "destructive" }); },
  });

  const bulkUploadMutation = useMutation({
    mutationFn: async (rows: any[]) => {
      const res = await fetch("/api/work-orders/bulk-upload", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }), credentials: "include",
      });
      const data = await res.json() as { message?: string; created: number; errors: string[] };
      if (!res.ok) { if (data.errors?.length) setBulkErrors(data.errors); throw new Error(data.message || "Toplu yükleme sırasında bir sorun oluştu."); }
      return data;
    },
    onSuccess: (data) => {
      invalidateWO();
      if (data.errors?.length) {
        setBulkErrors(data.errors);
        toast({ title: `${data.created} iş emri oluşturuldu, ${data.errors.length} uyarı var`, variant: data.created > 0 ? "default" : "destructive" });
      } else {
        setShowBulkModal(false); setBulkRows([]); setBulkErrors([]);
        toast({ title: `${data.created} iş emri başarıyla oluşturuldu` });
      }
    },
    onError: (err: Error) => { toast({ title: "Yükleme başarısız", description: err.message, variant: "destructive" }); },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = new Uint8Array(evt.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
      const rows = jsonData.slice(1).filter(row => row.length > 0 && row[0]).map(row => ({
        orderNumber: String(row[0] || ""), customerName: String(row[1] || ""),
        partCode: String(row[2] || ""), partName: String(row[3] || ""),
        targetQty: Number(row[4] || 0), unitPrice: Number(row[5] || 0),
        materialCost: Number(row[6] || 0), toolCost: Number(row[7] || 0),
        costCurrency: String(row[8] || "EUR").toUpperCase(), operationRoute: String(row[9] || ""),
      }));
      setBulkRows(rows); setBulkErrors([]);
    };
    reader.readAsArrayBuffer(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const getOpName = (opId: number) => { const op = operations?.find(o => o.id === opId); return op ? `${op.code} - ${op.name}` : `OP #${opId}`; };
  const getOpCode = (opId: number) => { const op = operations?.find(o => o.id === opId); return op?.code || `OP${opId}`; };
  const availableOpsForRoute = operations || [];

  const getStatusBadge = (wo: WorkOrder) => {
    if (wo.status === "completed") return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" data-testid={`badge-status-${wo.id}`}>
        <CheckCircle className="w-3 h-3" /> Tamamlandı
      </span>
    );
    if (wo.status === "in_progress") return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400" data-testid={`badge-status-${wo.id}`}>
        <Loader2 className="w-3 h-3 animate-spin" /> Devam Ediyor
      </span>
    );
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400" data-testid={`badge-status-${wo.id}`}>
        <Hourglass className="w-3 h-3" /> Bekliyor
      </span>
    );
  };

  const getProgress = (wo: AugmentedWorkOrder) => {
    const total = wo.totalOps ?? wo.operationRoute?.length ?? 0;
    const done = wo.completedOps ?? Math.min(wo.currentOperationIndex ?? 0, total);
    return { total, done, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
  };

  const renderWoFormDialog = ({ open, onOpenChange, icon, title, description, onSubmit, isPending, submitLabel, pendingLabel }: {
    open: boolean; onOpenChange: (open: boolean) => void; icon: React.ReactNode; title: string; description: string;
    onSubmit: () => void; isPending: boolean; submitLabel: string; pendingLabel: string;
  }) => (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">{icon}{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">İş Emri Numarası</label>
              <Input value={formOrderNumber} onChange={e => setFormOrderNumber(e.target.value)} placeholder="IE-2026-004" className="h-12" data-testid="input-wo-number" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Hedef Miktar</label>
              <Input type="number" min="1" value={formTargetQty} onChange={e => setFormTargetQty(e.target.value)} placeholder="100" className="h-12" data-testid="input-wo-qty" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Ürün Adı</label>
              <Input value={formProductName} onChange={e => setFormProductName(e.target.value)} placeholder="Örnek: Mil Saft 50mm" className="h-12" data-testid="input-wo-product" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Birim Satış Fiyatı (€)</label>
              <Input type="number" min="0" step="0.01" value={formTargetPrice} onChange={e => setFormTargetPrice(e.target.value)} placeholder="0" className="h-12" data-testid="input-wo-price" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Malzeme Maliyeti (Birim)</label>
              <Input type="number" min="0" step="0.01" value={formMaterialCost} onChange={e => setFormMaterialCost(e.target.value)} placeholder="0" className="h-12" data-testid="input-wo-material-cost" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Takım Maliyeti (Birim)</label>
              <Input type="number" min="0" step="0.01" value={formToolCost} onChange={e => setFormToolCost(e.target.value)} placeholder="0" className="h-12" data-testid="input-wo-tool-cost" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Para Birimi</label>
              <select value={formCostCurrency} onChange={e => setFormCostCurrency(e.target.value)} className="h-12 w-full rounded-md border border-input bg-background px-3 text-sm" data-testid="select-wo-cost-currency">
                <option value="EUR">EUR</option>
                <option value="TRY">TRY</option>
              </select>
            </div>
          </div>
          {(() => {
            const qty = parseInt(formTargetQty) || 0;
            const mat = parseFloat(formMaterialCost) || 0;
            const tool = parseFloat(formToolCost) || 0;
            const total = (mat + tool) * qty;
            if (total > 0) return (
              <div className="p-3 bg-muted/50 rounded-md space-y-1 text-xs" data-testid="text-wo-cost-summary">
                <div className="flex justify-between"><span className="text-muted-foreground">Malzeme Toplam:</span><span className="font-medium">{(mat * qty).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} {formCostCurrency}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Takım Toplam:</span><span className="font-medium">{(tool * qty).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} {formCostCurrency}</span></div>
                <div className="flex justify-between border-t border-border/50 pt-1 font-semibold"><span>Direkt Maliyet Toplamı:</span><span>{total.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} {formCostCurrency}</span></div>
              </div>
            );
            return null;
          })()}
          <div className="space-y-2">
            <label className="text-sm font-medium">Operasyon Rotası</label>
            <p className="text-xs text-muted-foreground">Üretim aşamalarını sırayla ekleyin. Aynı operasyon birden fazla eklenebilir.</p>
            {formRoute.length > 0 && (
              <div className="space-y-1 p-3 bg-muted/50 rounded-md">
                {formRoute.map((opId, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 bg-background rounded-md">
                    <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="text-xs font-mono text-muted-foreground w-6">{idx + 1}.</span>
                    <Badge variant="secondary" className="font-mono text-xs">{getOpCode(opId)}</Badge>
                    <span className="text-sm flex-1">{getOpName(opId)}</span>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveUp(idx)} disabled={idx === 0}><ArrowUp className="w-3 h-3" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveDown(idx)} disabled={idx === formRoute.length - 1}><ArrowDown className="w-3 h-3" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeFromRoute(idx)}><X className="w-3 h-3 text-destructive" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              {availableOpsForRoute.map(op => (
                <Button key={op.id} variant="outline" size="sm" onClick={() => addToRoute(op.id)} data-testid={`button-add-op-${op.id}`}>
                  <Plus className="w-3 h-3 mr-1" />{op.code}
                </Button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button className="w-full h-12" onClick={onSubmit} disabled={!formOrderNumber || !formProductName || !formTargetQty || formRoute.length === 0 || isPending} data-testid="button-save-workorder">
              <Save className="w-4 h-4 mr-2" />{isPending ? pendingLabel : submitLabel}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Package className="w-5 h-5 text-muted-foreground" />
          İş Emri Yönetimi
        </h2>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" onClick={() => { setShowBulkModal(true); setBulkRows([]); setBulkErrors([]); }} data-testid="button-bulk-upload">
            <Upload className="w-4 h-4 mr-2" />Excel'den Toplu Yükle
          </Button>
          <Button onClick={openAdd} data-testid="button-add-workorder">
            <Plus className="w-4 h-4 mr-2" />Yeni İş Emri
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3" data-testid="section-stats">
        <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30"><Activity className="w-4 h-4 text-blue-600 dark:text-blue-400" /></div>
            <div>
              <p className="text-[11px] text-muted-foreground font-medium">Aktif İşler</p>
              <p className="text-xl font-bold text-blue-600 dark:text-blue-400" data-testid="stat-active">{stats.active}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-900/10">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30"><Clock className="w-4 h-4 text-orange-600 dark:text-orange-400" /></div>
            <div>
              <p className="text-[11px] text-muted-foreground font-medium">Bekleyen İşler</p>
              <p className="text-xl font-bold text-orange-600 dark:text-orange-400" data-testid="stat-pending">{stats.pending}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30"><CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /></div>
            <div>
              <p className="text-[11px] text-muted-foreground font-medium">Tamamlanan İşler</p>
              <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400" data-testid="stat-completed">{stats.completed}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50">
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="İş emri no veya ürün ara..."
                className="pl-8 h-8 text-sm"
                data-testid="input-search-wo"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <ListFilter className="w-3.5 h-3.5 text-muted-foreground" />
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                data-testid="select-status-filter"
              >
                <option value="all">Tüm Durumlar</option>
                <option value="pending">Bekliyor</option>
                <option value="in_progress">Devam Ediyor</option>
                <option value="completed">Tamamlandı</option>
              </select>
            </div>
            <div className="flex items-center gap-1.5">
              <CalendarRange className="w-3.5 h-3.5 text-muted-foreground" />
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-8 text-xs w-36" data-testid="input-start-date" />
              <span className="text-muted-foreground text-xs">-</span>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-8 text-xs w-36" data-testid="input-end-date" />
            </div>
            {(search || statusFilter !== "all" || startDate || endDate) && (
              <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => { setSearch(""); setStatusFilter("all"); setStartDate(""); setEndDate(""); }} data-testid="button-clear-filters">
                <X className="w-3 h-3 mr-1" /> Temizle
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-44 rounded-xl" />)}
        </div>
      ) : workOrders.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Package className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground font-medium">İş emri bulunamadı.</p>
            <p className="text-sm text-muted-foreground/60 mt-1">Arama kriterlerini değiştirin veya yeni iş emri ekleyin.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {workOrders.map(wo => {
            const { pct, done, total: opTotal } = getProgress(wo);
            const qtyPct = wo.targetQuantity > 0 ? Math.round((wo.completedQuantity / wo.targetQuantity) * 100) : 0;
            return (
              <Card
                key={wo.id}
                className="hover:shadow-md transition-shadow cursor-pointer border-border/60 group"
                onClick={() => setDetailWo(wo)}
                data-testid={`card-manage-wo-${wo.id}`}
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-sm">{wo.orderNumber}</span>
                        {getStatusBadge(wo)}
                      </div>
                      <p className="text-sm text-foreground font-medium truncate">{wo.productName}</p>
                      {wo.customerName && <p className="text-xs text-muted-foreground truncate">{wo.customerName}</p>}
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(wo)} data-testid={`button-edit-wo-${wo.id}`}><Pencil className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDeleteWo(wo)} disabled={wo.status === "in_progress"} data-testid={`button-delete-wo-${wo.id}`}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 bg-muted/50 rounded-md">
                      <p className="text-muted-foreground text-[10px]">Hedef / Üretilen</p>
                      <p className="font-semibold">{wo.completedQuantity} / {wo.targetQuantity} <span className="font-normal text-muted-foreground">adet</span></p>
                    </div>
                    <div className="p-2 bg-muted/50 rounded-md">
                      <p className="text-muted-foreground text-[10px]">Operasyon İlerlemesi</p>
                      <p className="font-semibold">{done} / {opTotal} <span className="font-normal text-muted-foreground">op</span></p>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">Miktar</span>
                      <span className="font-medium">{qtyPct}%</span>
                    </div>
                    <Progress value={qtyPct} className="h-1.5" />
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">Operasyon</span>
                      <span className="font-medium">{pct}%</span>
                    </div>
                    <Progress value={pct} className="h-1" />
                  </div>

                  {isSuperAdmin && (() => {
                    const price = parseFloat(wo.targetPrice || "0");
                    if (price > 0) return (
                      <div className="flex items-center justify-between text-[11px] border-t border-border/30 pt-2">
                        <span className="text-muted-foreground">Toplam Değer</span>
                        <span className="font-semibold" data-testid={`text-wo-total-${wo.id}`}>{(price * wo.targetQuantity).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} EUR</span>
                      </div>
                    );
                    return null;
                  })()}

                  <Button variant="outline" size="sm" className="w-full h-7 text-xs gap-1.5 mt-1" onClick={e => { e.stopPropagation(); setDetailWo(wo); }} data-testid={`button-detail-wo-${wo.id}`}>
                    <Eye className="w-3 h-3" /> Detay
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2" data-testid="section-pagination">
          <p className="text-xs text-muted-foreground">
            Toplam {total} iş emri — Sayfa {page} / {totalPages}
          </p>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} data-testid="button-prev-page">
              <ChevronLeft className="w-3.5 h-3.5" /> Önceki
            </Button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pg: number;
              if (totalPages <= 5) { pg = i + 1; }
              else if (page <= 3) { pg = i + 1; }
              else if (page >= totalPages - 2) { pg = totalPages - 4 + i; }
              else { pg = page - 2 + i; }
              return (
                <Button key={pg} variant={page === pg ? "default" : "outline"} size="sm" className="h-7 w-7 p-0 text-xs" onClick={() => setPage(pg)} data-testid={`button-page-${pg}`}>
                  {pg}
                </Button>
              );
            })}
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} data-testid="button-next-page">
              Sonraki <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}

      <Sheet open={!!detailWo} onOpenChange={open => !open && setDetailWo(null)}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-0">
          {detailWo && (
            <>
              <SheetHeader className="p-5 pb-4 border-b border-border/50 sticky top-0 bg-background z-10">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <SheetTitle className="flex items-center gap-2 text-base">
                      <span className="font-mono">{detailWo.orderNumber}</span>
                      {getStatusBadge(detailWo)}
                    </SheetTitle>
                    <p className="text-sm text-muted-foreground mt-0.5">{detailWo.productName}</p>
                    {detailWo.customerName && <p className="text-xs text-muted-foreground">{detailWo.customerName}</p>}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={() => { openEdit(detailWo); setDetailWo(null); }} data-testid="button-edit-detail-wo">
                      <Pencil className="w-3 h-3" /> Düzenle
                    </Button>
                    <SheetClose asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7"><X className="w-4 h-4" /></Button>
                    </SheetClose>
                  </div>
                </div>
              </SheetHeader>

              <div className="p-5 space-y-5">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-muted-foreground text-[10px] mb-0.5">Hedef Adet</p>
                    <p className="font-semibold text-sm">{detailWo.targetQuantity}</p>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-muted-foreground text-[10px] mb-0.5">Üretilen Adet</p>
                    <p className="font-semibold text-sm">{detailWo.completedQuantity}</p>
                  </div>
                  {isSuperAdmin && (
                    <>
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-muted-foreground text-[10px] mb-0.5">Birim Fiyat</p>
                        <p className="font-semibold text-sm" data-testid={`text-wo-price-${detailWo.id}`}>{parseFloat(detailWo.targetPrice || "0").toLocaleString("tr-TR")} EUR</p>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-muted-foreground text-[10px] mb-0.5">Toplam Değer</p>
                        <p className="font-semibold text-sm" data-testid={`text-wo-total-${detailWo.id}`}>{(parseFloat(detailWo.targetPrice || "0") * detailWo.targetQuantity).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} EUR</p>
                      </div>
                    </>
                  )}
                </div>

                {isSuperAdmin && (() => {
                  const woLine = workOrderLines?.find(l => l.workOrderId === detailWo.id);
                  const mat = parseFloat(woLine?.materialCostPerUnit || "0");
                  const tool = parseFloat(woLine?.toolCostPerUnit || "0");
                  const currency = woLine?.costCurrency || "EUR";
                  if (mat > 0 || tool > 0) return (
                    <div className="grid grid-cols-2 gap-3 text-xs" data-testid={`text-wo-costs-${detailWo.id}`}>
                      <div className="p-3 bg-orange-500/5 rounded-lg">
                        <p className="text-muted-foreground text-[10px] mb-0.5">Malzeme Maliyeti</p>
                        <p className="font-semibold text-orange-600 dark:text-orange-400">{mat.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} {currency}/adet</p>
                      </div>
                      <div className="p-3 bg-purple-500/5 rounded-lg">
                        <p className="text-muted-foreground text-[10px] mb-0.5">Takım Maliyeti</p>
                        <p className="font-semibold text-purple-600 dark:text-purple-400">{tool.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} {currency}/adet</p>
                      </div>
                    </div>
                  );
                  return null;
                })()}

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground font-medium">Miktar İlerlemesi</span>
                    <span className="font-semibold">{detailWo.completedQuantity} / {detailWo.targetQuantity} adet ({detailWo.targetQuantity > 0 ? Math.round(detailWo.completedQuantity / detailWo.targetQuantity * 100) : 0}%)</span>
                  </div>
                  <Progress value={detailWo.targetQuantity > 0 ? Math.round(detailWo.completedQuantity / detailWo.targetQuantity * 100) : 0} className="h-2" />
                </div>

                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground">Operasyon Rotası</p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {(detailWo.operationRoute || []).map((opId, idx) => {
                      const isDone = idx < detailWo.currentOperationIndex;
                      const isCurrent = idx === detailWo.currentOperationIndex && detailWo.status !== "completed";
                      return (
                        <Badge key={idx} variant={isDone ? "default" : isCurrent ? "secondary" : "outline"} className="text-xs font-mono">
                          {getOpCode(opId)}{isDone && <CheckCircle className="w-2.5 h-2.5 ml-1" />}
                        </Badge>
                      );
                    })}
                  </div>
                </div>

                <div className="border-t border-border/40 pt-4">
                  <p className="text-xs font-semibold text-muted-foreground mb-3">Teknik Resim</p>
                  <TechnicalDrawingSection workOrderId={detailWo.id} />
                </div>

                <div className="border-t border-border/40 pt-4">
                  <p className="text-xs font-semibold text-muted-foreground mb-3">Operasyon Planı</p>
                  <WorkOrderOperationsPanel
                    workOrderId={detailWo.id}
                    operations={operations || []}
                    machines={machines}
                  />
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {renderWoFormDialog({ open: showAddModal, onOpenChange: setShowAddModal, icon: <Plus className="w-5 h-5" />, title: "Yeni İş Emri Oluştur", description: "Ürün, miktar ve operasyon rotasını tanımlayarak yeni bir iş emri oluşturun.", onSubmit: () => createMutation.mutate(), isPending: createMutation.isPending, submitLabel: "İş Emri Oluştur", pendingLabel: "Oluşturuluyor..." })}

      {renderWoFormDialog({ open: !!editWo, onOpenChange: open => !open && setEditWo(null), icon: <Pencil className="w-5 h-5" />, title: "İş Emrini Düzenle", description: "İş emri bilgilerini ve operasyon rotasını güncelleyin.", onSubmit: () => updateMutation.mutate(), isPending: updateMutation.isPending, submitLabel: "Güncelle", pendingLabel: "Güncelleniyor..." })}

      <Dialog open={!!deleteWo} onOpenChange={open => !open && setDeleteWo(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Trash2 className="w-5 h-5 text-destructive" />İş Emrini Sil</DialogTitle>
            <DialogDescription>Bu işlem geri alınamaz.</DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground"><span className="font-medium text-foreground">{deleteWo?.orderNumber} - {deleteWo?.productName}</span> iş emrini silmek istediğinizden emin misiniz?</p>
          <DialogFooter className="gap-2">
            <Button variant="secondary" onClick={() => setDeleteWo(null)}>İptal</Button>
            <Button variant="destructive" onClick={() => deleteWo && deleteMutation.mutate(deleteWo.id)} disabled={deleteMutation.isPending} data-testid="button-confirm-delete-wo">Sil</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showBulkModal} onOpenChange={setShowBulkModal}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FileSpreadsheet className="w-5 h-5" />Excel'den Toplu İş Emri Yükle</DialogTitle>
            <DialogDescription>Excel şablonunu indirin, doldurun ve yükleyin.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="outline" onClick={() => window.open("/api/work-orders/template/download", "_blank")} data-testid="button-download-template">
                <Download className="w-4 h-4 mr-2" />Şablon İndir
              </Button>
              <Button variant="outline" onClick={() => fileInputRef.current?.click()} data-testid="button-select-file">
                <Upload className="w-4 h-4 mr-2" />Dosya Seç
              </Button>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileSelect} />
            </div>
            {bulkRows.length > 0 && (
              <div className="overflow-auto max-h-64 border rounded-md">
                <table className="w-full text-xs" data-testid="table-bulk-preview">
                  <thead className="bg-muted sticky top-0">
                    <tr>{["İş Emri No","Müşteri","Parça Kodu","Parça Adı","Adet","Birim Fiyat","Malzeme","Takım","Birim","Rota"].map(h => <th key={h} className="p-2 text-left">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {bulkRows.map((row, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="p-2">{row.orderNumber}</td><td className="p-2">{row.customerName}</td>
                        <td className="p-2">{row.partCode}</td><td className="p-2">{row.partName}</td>
                        <td className="p-2 text-right">{row.targetQty}</td><td className="p-2 text-right">{row.unitPrice}</td>
                        <td className="p-2 text-right">{row.materialCost}</td><td className="p-2 text-right">{row.toolCost}</td>
                        <td className="p-2 text-center">{row.costCurrency}</td><td className="p-2">{row.operationRoute}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {bulkErrors.length > 0 && (
              <div className="space-y-1 p-3 bg-destructive/10 rounded-md">
                {bulkErrors.map((err, idx) => <p key={idx} className="text-xs text-destructive">{err}</p>)}
              </div>
            )}
            <DialogFooter>
              <Button className="w-full" onClick={() => bulkUploadMutation.mutate(bulkRows)} disabled={bulkRows.length === 0 || bulkUploadMutation.isPending} data-testid="button-confirm-bulk">
                {bulkUploadMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Yükleniyor...</> : <><Upload className="w-4 h-4 mr-2" />Yükle ({bulkRows.length} satır)</>}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
