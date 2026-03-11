import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Play, Square, RotateCcw, CheckCircle, Clock, AlertTriangle,
  Settings2, ArrowLeft, Timer, Package, Cog, User as UserIcon,
  CircleDot, Pause, Flag, FileText, ExternalLink, Layers,
  MessageSquare, Send, Paperclip, Loader2, X,
  ImageIcon, Eye, Maximize2,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import lockcellLogoWhite from "@assets/lockcell-beyaz_1772012570656.webp";
import lockcellLogoDark from "@assets/lockcell_logo_1772012546609.webp";
import type { User, Machine, Operation, WorkOrder, StopReason, ProductionLog, WorkOrderLine, WorkOrderAttachment, ChatMessage, TechnicalDrawing, DrawingAcknowledgment, WorkOrderOperation } from "@shared/schema";

function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = "sine";
    gain.gain.value = 0.15;
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.stop(ctx.currentTime + 0.3);
  } catch {}
}

interface LicenseStatusInfo {
  status: "active" | "demo" | "grace" | "expired";
  daysRemaining: number;
  expiryDate: string | null;
  message: string;
}

interface OperatorPanelProps {
  user: User;
  onBack: () => void;
  initialMachineId?: number | null;
  licenseStatus: LicenseStatusInfo | null;
}

type PanelStep = "setup" | "ready" | "running" | "paused";
type StopModalStep = "reason" | "quantity";

export default function OperatorPanel({ user, onBack, initialMachineId, licenseStatus }: OperatorPanelProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<PanelStep>("setup");
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState<string>("");
  const [selectedLineId, setSelectedLineId] = useState<string>("");
  const [selectedOperationId, setSelectedOperationId] = useState<string>("");
  const [selectedMachineId, setSelectedMachineId] = useState<string>(initialMachineId ? String(initialMachineId) : "");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showStopModal, setShowStopModal] = useState(false);
  const [stopModalStep, setStopModalStep] = useState<StopModalStep>("reason");
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [pdfFilterLineId, setPdfFilterLineId] = useState<number | null>(null);
  const [selectedStopReasonId, setSelectedStopReasonId] = useState<string>("");
  const [quantityInput, setQuantityInput] = useState("");
  const [acceptedQuantityInput, setAcceptedQuantityInput] = useState("");
  const [activeLogId, setActiveLogId] = useState<number | null>(null);
  const [totalProduced, setTotalProduced] = useState(0);
  const [showChatModal, setShowChatModal] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const [chatUploading, setChatUploading] = useState(false);
  const [showDrawingFullscreen, setShowDrawingFullscreen] = useState(false);
  const [drawingAcknowledged, setDrawingAcknowledged] = useState(false);
  const [showTakeoverModal, setShowTakeoverModal] = useState(false);
  const [takeoverLogData, setTakeoverLogData] = useState<ProductionLog | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatFileRef = useRef<HTMLInputElement>(null);
  const prevDrawingRevRef = useRef<number | null>(null);

  const { data: workOrders } = useQuery<(WorkOrder & { totalOps?: number; completedOps?: number })[]>({ queryKey: ["/api/work-orders"], refetchInterval: 10000 });
  const { data: allOperations } = useQuery<Operation[]>({ queryKey: ["/api/operations"] });
  const { data: stopReasons } = useQuery<StopReason[]>({ queryKey: ["/api/stop-reasons"] });
  const { data: machines } = useQuery<Machine[]>({ queryKey: ["/api/machines"] });
  const { data: woLines } = useQuery<WorkOrderLine[]>({
    queryKey: ["/api/work-orders", selectedWorkOrderId, "lines"],
    enabled: !!selectedWorkOrderId,
  });
  const { data: woAttachments } = useQuery<WorkOrderAttachment[]>({
    queryKey: ["/api/work-orders", selectedWorkOrderId, "attachments"],
    enabled: !!selectedWorkOrderId,
  });

  const { data: selectedWoOps = [] } = useQuery<WorkOrderOperation[]>({
    queryKey: ["/api/work-order-operations", selectedWorkOrderId],
    queryFn: () =>
      selectedWorkOrderId
        ? fetch(`/api/work-order-operations/${selectedWorkOrderId}`, { credentials: "include" }).then((r) => r.json())
        : Promise.resolve([]),
    enabled: !!selectedWorkOrderId,
    refetchInterval: 8000,
  });

  const nextOpIdForQuery = useMemo(() => {
    if (selectedWoOps.length > 0) {
      const nxt = selectedWoOps
        .filter((wop) => wop.status !== "completed")
        .sort((a, b) => a.sequenceNumber - b.sequenceNumber)[0];
      return nxt?.operationId ?? null;
    }
    const wo = workOrders?.find((w) => w.id === Number(selectedWorkOrderId));
    return wo?.operationRoute[wo.currentOperationIndex] ?? null;
  }, [selectedWoOps, workOrders, selectedWorkOrderId]);

  const { data: allowedMachinesForNextOp = [] } = useQuery<Machine[]>({
    queryKey: ["/api/operations", nextOpIdForQuery, "machines"],
    queryFn: () =>
      nextOpIdForQuery
        ? fetch(`/api/operations/${nextOpIdForQuery}/machines`, { credentials: "include" }).then((r) => r.json())
        : Promise.resolve([]),
    enabled: !!nextOpIdForQuery,
  });

  const { data: currentDrawing } = useQuery<TechnicalDrawing | null>({
    queryKey: ["/api/technical-drawings", selectedWorkOrderId, "current"],
    enabled: !!selectedWorkOrderId,
    refetchInterval: 5000,
  });

  const { data: drawingAcks = [] } = useQuery<DrawingAcknowledgment[]>({
    queryKey: ["/api/technical-drawings/acknowledgments", currentDrawing?.id ? String(currentDrawing.id) : "0"],
    enabled: !!currentDrawing?.id,
    refetchInterval: 5000,
  });

  const hasAckedCurrentDrawing = drawingAcknowledged || (currentDrawing ? drawingAcks.some(a => a.userId === user.id) : true);

  useEffect(() => {
    if (!currentDrawing) {
      prevDrawingRevRef.current = null;
      setDrawingAcknowledged(false);
      return;
    }
    if (prevDrawingRevRef.current === null) {
      prevDrawingRevRef.current = currentDrawing.revisionNumber;
      if (drawingAcks.some(a => a.userId === user.id)) {
        setDrawingAcknowledged(true);
      }
      return;
    }
    if (currentDrawing.revisionNumber > prevDrawingRevRef.current) {
      setDrawingAcknowledged(false);
      prevDrawingRevRef.current = currentDrawing.revisionNumber;
      toast({ title: "Yeni teknik resim revizyonu", description: `Rev.${currentDrawing.revisionNumber} yüklendi. Lütfen inceleyin.` });
      playNotificationSound();
    }
  }, [currentDrawing, drawingAcks, user.id, toast]);

  const acknowledgeMutation = useMutation({
    mutationFn: async () => {
      if (!currentDrawing) return;
      await apiRequest("POST", `/api/technical-drawings/${currentDrawing.id}/acknowledge`);
    },
    onSuccess: () => {
      setDrawingAcknowledged(true);
      if (currentDrawing) {
        queryClient.invalidateQueries({ queryKey: ["/api/technical-drawings/acknowledgments", String(currentDrawing.id)] });
      }
      toast({ title: "Revizyon onaylandı" });
    },
    onError: () => {
      toast({ title: "Onay kaydedilemedi", variant: "destructive" });
    },
  });

  const isImageFile = (name: string) => {
    const ext = name.split(".").pop()?.toLowerCase() || "";
    return ["jpg", "jpeg", "png", "gif", "webp"].includes(ext);
  };

  const { data: allowedMachinesForOp } = useQuery<Machine[]>({
    queryKey: ["/api/operations", selectedOperationId, "machines"],
    enabled: !!selectedOperationId,
  });

  const machineCompatible = (() => {
    if (!selectedOperationId || !selectedMachineId) return true;
    if (!allowedMachinesForOp) return true;
    if (allowedMachinesForOp.length === 0) return true;
    return allowedMachinesForOp.some(m => m.id === Number(selectedMachineId));
  })();

  const { data: activeLog, isLoading: isLoadingActiveLog } = useQuery<ProductionLog | null>({
    queryKey: ["/api/production-logs", "active-by-user", String(user.id)],
    refetchOnWindowFocus: false,
  });

  const machineIdForActiveCheck = selectedMachineId || (initialMachineId ? String(initialMachineId) : "");
  const { data: machineActiveLog } = useQuery<ProductionLog | null>({
    queryKey: ["/api/production-logs", "active", machineIdForActiveCheck],
    enabled: !!machineIdForActiveCheck && step === "setup",
  });

  const takeoverMutation = useMutation({
    mutationFn: async (machineId: number) => {
      const res = await apiRequest("PATCH", "/api/logs/takeover", { machineId });
      return res.json();
    },
    onSuccess: (data: { success: boolean; logId: number }) => {
      setShowTakeoverModal(false);
      if (takeoverLogData) {
        setActiveLogId(data.logId);
        setSelectedWorkOrderId(String(takeoverLogData.workOrderId));
        setSelectedOperationId(String(takeoverLogData.operationId));
        setSelectedMachineId(String(takeoverLogData.machineId));
        setTotalProduced(takeoverLogData.producedQuantity || 0);

        const startTime = new Date(takeoverLogData.startTime!).getTime();
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        setElapsedSeconds(Math.max(0, elapsed));

        if (takeoverLogData.status === "running") {
          setStep("running");
        } else if (takeoverLogData.status === "paused") {
          setStep("paused");
        }
      }
      setTakeoverLogData(null);
      toast({ title: "Vardiya devralındı", description: "İş başarıyla devralınmıştır." });
      queryClient.invalidateQueries({ queryKey: ["/api/machines"] });
      queryClient.invalidateQueries({ queryKey: ["/api/production-logs"] });
    },
    onError: (err: Error) => {
      toast({ title: "Hata", description: err.message, variant: "destructive" });
    },
  });

  const chatMachineId = selectedMachineId || (initialMachineId ? String(initialMachineId) : "");
  const loginTimeRef = useRef<Date>(new Date());
  const prevUnreadIdsRef = useRef<Set<number> | null>(null);
  const hasMarkedReadRef = useRef(false);
  const { data: chatMessages = [] } = useQuery<ChatMessage[]>({
    queryKey: ["/api/chat", chatMachineId],
    enabled: !!chatMachineId,
    refetchInterval: 5000,
  });

  const { data: readStatusData } = useQuery<{ lastReadAt: string | null }>({
    queryKey: ["/api/chat/read-status", chatMachineId],
    enabled: !!chatMachineId,
    refetchInterval: 10000,
  });

  const markReadMutation = useMutation({
    mutationFn: async () => {
      if (!chatMachineId) return;
      await apiRequest("POST", `/api/chat/mark-read/${chatMachineId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat/read-status", chatMachineId] });
    },
  });

  const lastReadAt = readStatusData?.lastReadAt ? new Date(readStatusData.lastReadAt) : null;

  const unreadAdminMessages = chatMessages.filter(m => {
    if (!m.isAdminMessage) return false;
    if (!m.createdAt) return false;
    const msgTime = new Date(m.createdAt);
    if (lastReadAt && msgTime <= lastReadAt) return false;
    return true;
  });

  useEffect(() => {
    if (showChatModal) {
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      if (chatMachineId && unreadAdminMessages.length > 0 && !hasMarkedReadRef.current) {
        hasMarkedReadRef.current = true;
        markReadMutation.mutate();
      }
    } else {
      hasMarkedReadRef.current = false;
    }
  }, [chatMessages, showChatModal, chatMachineId]);

  useEffect(() => {
    if (!showChatModal && chatMachineId && unreadAdminMessages.length > 0) {
      const loginTime = loginTimeRef.current;
      const newMsgIds = new Set(unreadAdminMessages.map(m => m.id));

      if (prevUnreadIdsRef.current === null) {
        const initialNewAfterLogin = unreadAdminMessages.filter(m =>
          new Date(m.createdAt!) > loginTime
        );
        if (initialNewAfterLogin.length > 0) {
          toast({ title: "Yeni mesaj", description: "Yoneticiden yeni mesaj geldi" });
          playNotificationSound();
        }
        prevUnreadIdsRef.current = newMsgIds;
        return;
      }

      const trulyNewIds = [...newMsgIds].filter(id => !prevUnreadIdsRef.current!.has(id));
      const trulyNewAfterLogin = unreadAdminMessages.filter(m =>
        trulyNewIds.includes(m.id) && new Date(m.createdAt!) > loginTime
      );

      if (trulyNewAfterLogin.length > 0) {
        toast({ title: "Yeni mesaj", description: "Yoneticiden yeni mesaj geldi" });
        playNotificationSound();
      }

      prevUnreadIdsRef.current = newMsgIds;
    }
  }, [unreadAdminMessages, showChatModal, toast]);

  const chatSendMutation = useMutation({
    mutationFn: async (data: { message?: string; fileUrl?: string }) => {
      await apiRequest("POST", `/api/chat/${chatMachineId}`, data);
    },
    onSuccess: () => {
      setChatMessage("");
      queryClient.invalidateQueries({ queryKey: ["/api/chat", chatMachineId] });
    },
    onError: (err: Error) => {
      toast({ title: "Hata", description: err.message, variant: "destructive" });
    },
  });

  const handleChatSend = () => {
    const trimmed = chatMessage.trim();
    if (!trimmed || !chatMachineId) return;
    chatSendMutation.mutate({ message: trimmed });
  };

  const handleChatFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !chatMachineId) return;

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({ title: "Dosya çok büyük", description: "Maksimum 10MB yüklenebilir", variant: "destructive" });
      if (chatFileRef.current) chatFileRef.current.value = "";
      return;
    }

    setChatUploading(true);
    try {
      const res = await apiRequest("POST", "/api/uploads/request-url", {
        name: file.name,
        size: file.size,
        contentType: file.type,
      });
      const { uploadURL, objectPath } = await res.json();
      await fetch(uploadURL, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      const fileUrl = objectPath.startsWith("/objects/") ? objectPath : `/objects/${objectPath}`;
      chatSendMutation.mutate({ message: `Dosya: ${file.name}`, fileUrl });
    } catch {
      toast({ title: "Dosya yüklenemedi", variant: "destructive" });
    } finally {
      setChatUploading(false);
      if (chatFileRef.current) chatFileRef.current.value = "";
    }
  };

  const [sessionRestored, setSessionRestored] = useState(false);

  useEffect(() => {
    if (sessionRestored || isLoadingActiveLog) return;
    const loginMachineId = initialMachineId ? Number(initialMachineId) : null;
    if (activeLog && activeLog.status !== "completed") {
      if (loginMachineId && activeLog.machineId !== loginMachineId) {
        setSessionRestored(true);
        return;
      }
      setActiveLogId(activeLog.id);
      setSelectedWorkOrderId(String(activeLog.workOrderId));
      setSelectedOperationId(String(activeLog.operationId));
      setSelectedMachineId(String(activeLog.machineId));
      setTotalProduced(activeLog.producedQuantity || 0);

      const startTime = new Date(activeLog.startTime!).getTime();
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setElapsedSeconds(Math.max(0, elapsed));

      if (activeLog.status === "running") {
        setStep("running");
      } else if (activeLog.status === "paused") {
        setStep("paused");
      }
    }
    setSessionRestored(true);
  }, [activeLog, isLoadingActiveLog, sessionRestored, initialMachineId]);

  useEffect(() => {
    if (step !== "setup" || !machineActiveLog || !sessionRestored) return;
    if (machineActiveLog.userId !== user.id && machineActiveLog.status !== "completed") {
      setTakeoverLogData(machineActiveLog);
      setShowTakeoverModal(true);
    }
  }, [machineActiveLog, step, sessionRestored, user.id]);

  const selectedWorkOrder = workOrders?.find((w) => w.id === Number(selectedWorkOrderId));
  const selectedLine = woLines?.find((l) => l.id === Number(selectedLineId));
  const availableOperations = selectedWorkOrder && allOperations
    ? (() => {
        if (selectedWoOps.length > 0) {
          const nextWoOp = selectedWoOps
            .filter((wop) => wop.status !== "completed")
            .sort((a, b) => a.sequenceNumber - b.sequenceNumber)[0];
          if (!nextWoOp) return [];
          return allOperations.filter((op) => op.id === nextWoOp.operationId);
        }
        const currentOpId = selectedWorkOrder.operationRoute[selectedWorkOrder.currentOperationIndex];
        return currentOpId ? allOperations.filter((op) => op.id === currentOpId) : [];
      })()
    : [];

  const hasNoRoute = !!selectedWorkOrderId && selectedWoOps.length === 0 && (selectedWorkOrder?.operationRoute?.length ?? 0) === 0;
  const allOpsCompleted = !!selectedWorkOrderId && selectedWoOps.length > 0 && selectedWoOps.every((op) => op.status === "completed");

  const canDoOnCurrentMachine =
    !selectedMachineId ||
    allowedMachinesForNextOp.length === 0 ||
    allowedMachinesForNextOp.some((m) => m.id === Number(selectedMachineId));
  const allowedMachineNames = allowedMachinesForNextOp.map((m) => m.code).join(", ");

  const activeLines = woLines?.filter(l => l.status !== "completed") || [];

  const lineAttachments = woAttachments?.filter(a => {
    if (selectedLineId) {
      return a.workOrderLineId === Number(selectedLineId) || !a.workOrderLineId;
    }
    return !a.workOrderLineId;
  }) || [];

  const allWoAttachments = woAttachments || [];

  useEffect(() => {
    if (step === "running") {
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [step]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const startMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/production-logs/start", {
        workOrderId: Number(selectedWorkOrderId),
        operationId: Number(selectedOperationId),
        machineId: Number(selectedMachineId),
        userId: user.id,
      });
      return res.json();
    },
    onSuccess: (data: ProductionLog) => {
      setActiveLogId(data.id);
      setStep("running");
      setElapsedSeconds(0);
      setTotalProduced(0);
      toast({ title: "Üretim başlatıldı" });
      queryClient.invalidateQueries({ queryKey: ["/api/machines"] });
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/production-logs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/work-order-operations", selectedWorkOrderId] });
    },
    onError: (err: Error) => {
      toast({ title: "Hata", description: err.message, variant: "destructive" });
    },
  });

  const stopMutation = useMutation({
    mutationFn: async (params: { stopReasonId: number; producedQuantity: number; acceptedQuantity?: number }) => {
      await apiRequest("POST", `/api/production-logs/${activeLogId}/stop`, params);
    },
    onSuccess: () => {
      const qty = parseInt(quantityInput) || 0;
      setTotalProduced((prev) => prev + qty);
      setStep("paused");
      setShowStopModal(false);
      setStopModalStep("reason");
      setSelectedStopReasonId("");
      setQuantityInput("");
      setAcceptedQuantityInput("");
      toast({ title: "Adet kaydedildi", description: qty > 0 ? `${qty} adet üretim kaydedildi.` : "Üretim durduruldu." });
      queryClient.invalidateQueries({ queryKey: ["/api/machines"] });
      queryClient.invalidateQueries({ queryKey: ["/api/production-logs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] });
    },
    onError: (err: Error) => {
      toast({ title: "Hata", description: err.message, variant: "destructive" });
    },
  });

  const resumeMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/production-logs/${activeLogId}/resume`);
    },
    onSuccess: () => {
      setStep("running");
      toast({ title: "Üretim devam ediyor" });
      queryClient.invalidateQueries({ queryKey: ["/api/machines"] });
      queryClient.invalidateQueries({ queryKey: ["/api/production-logs"] });
    },
    onError: (err: Error) => {
      toast({ title: "Hata", description: err.message, variant: "destructive" });
    },
  });

  const finishMutation = useMutation({
    mutationFn: async (data: { producedQuantity: number; acceptedQuantity?: number }) => {
      await apiRequest("POST", `/api/production-logs/${activeLogId}/finish`, data);
    },
    onSuccess: () => {
      setStep("setup");
      setActiveLogId(null);
      setSelectedWorkOrderId("");
      setSelectedLineId("");
      setSelectedOperationId("");
      setSelectedMachineId(initialMachineId ? String(initialMachineId) : "");
      setShowFinishModal(false);
      setQuantityInput("");
      setAcceptedQuantityInput("");
      setElapsedSeconds(0);
      setTotalProduced(0);
      toast({ title: "Operasyon tamamlandı", description: "İş emri bir sonraki operasyona sevk edildi." });
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/machines"] });
      queryClient.invalidateQueries({ queryKey: ["/api/production-logs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/work-order-operations"] });
    },
    onError: (err: Error) => {
      toast({ title: "Hata", description: err.message, variant: "destructive" });
    },
  });

  const targetQty = selectedLine?.targetQuantity ?? selectedWorkOrder?.targetQuantity ?? 0;
  const remainingQuantity = Math.max(0, targetQty - totalProduced);
  const enteredQty = parseInt(quantityInput) || 0;
  const isQuantityOverLimit = enteredQty > remainingQuantity;
  const isJobComplete = remainingQuantity === 0;

  const handleStopReasonSelected = () => {
    if (!selectedStopReasonId) return;
    setStopModalStep("quantity");
    setQuantityInput(remainingQuantity > 0 ? String(remainingQuantity) : "0");
  };

  const handleStopConfirm = () => {
    const qty = parseInt(quantityInput) || 0;
    const accepted = acceptedQuantityInput !== "" ? Math.min(parseInt(acceptedQuantityInput) || 0, qty) : qty;
    stopMutation.mutate({
      stopReasonId: Number(selectedStopReasonId),
      producedQuantity: qty,
      acceptedQuantity: accepted,
    });
  };

  const handleFinishConfirm = () => {
    const qty = parseInt(quantityInput) || 0;
    const accepted = acceptedQuantityInput !== "" ? Math.min(parseInt(acceptedQuantityInput) || 0, qty) : qty;
    finishMutation.mutate({ producedQuantity: qty, acceptedQuantity: accepted });
  };

  const canProceedToReady =
    selectedWorkOrderId && selectedOperationId && selectedMachineId && machineCompatible;

  const activeWorkOrders = workOrders?.filter(
    (w) => w.status === "pending" || w.status === "in_progress"
  ) ?? [];

  const myActiveWoIds = new Set(
    machineActiveLog && machineActiveLog.status !== "completed"
      ? [machineActiveLog.workOrderId]
      : []
  );
  const myActiveWorkOrders = activeWorkOrders.filter((w) => myActiveWoIds.has(w.id));
  const otherWorkOrders = activeWorkOrders.filter((w) => !myActiveWoIds.has(w.id));

  const getOpProgress = (wo: WorkOrder & { totalOps?: number; completedOps?: number }) => {
    const total = wo.totalOps ?? wo.operationRoute?.length ?? 0;
    const done = wo.completedOps ?? Math.min(wo.currentOperationIndex ?? 0, total);
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    return { total, done, pct };
  };

  const selectedOperation = allOperations?.find((op) => op.id === Number(selectedOperationId));
  const selectedMachine = machines?.find((m) => m.id === Number(selectedMachineId));

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="border-b border-border/50 bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3 px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="h-12 w-12 shrink-0"
            data-testid="button-back"
          >
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <div className="text-center flex-1 min-w-0">
            <div className="flex items-center justify-center gap-2">
              <img src={lockcellLogoDark} alt="Lockcell" className="h-6 object-contain dark:hidden" data-testid="img-operator-logo-light" />
              <img src={lockcellLogoWhite} alt="Lockcell" className="h-6 object-contain hidden dark:block" data-testid="img-operator-logo-dark" />
              <h1 className="font-bold text-xl tracking-tight" data-testid="text-panel-title">
                MES
              </h1>
            </div>
            <div className="flex items-center justify-center gap-2 mt-0.5 flex-wrap">
              <UserIcon className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground truncate" data-testid="text-operator-name">
                {user.fullName}
              </span>
              {selectedMachine && (
                <>
                  <span className="text-muted-foreground">•</span>
                  <Settings2 className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground font-mono" data-testid="text-header-machine">
                    {selectedMachine.code}
                  </span>
                </>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowChatModal(true)}
            className="h-12 w-12 shrink-0 relative"
            data-testid="button-operator-chat"
          >
            <MessageSquare className="w-6 h-6" />
            {unreadAdminMessages.length > 0 && !showChatModal && (
              <span className="absolute top-1 right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" data-testid="indicator-new-chat" />
            )}
          </Button>
        </div>
      </div>

      <Dialog open={showChatModal} onOpenChange={(open) => {
        setShowChatModal(open);
        if (!open && chatMachineId) {
          markReadMutation.mutate();
        }
      }}>
        <DialogContent className="max-w-lg h-[80vh] flex flex-col p-0">
          <DialogHeader className="p-4 pb-2 border-b border-border">
            <DialogTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="w-5 h-5 text-primary" />
              Yönetici Chat
            </DialogTitle>
            <DialogDescription className="text-xs">
              {selectedMachine ? `${selectedMachine.name} (${selectedMachine.code})` : "Tezgah"}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 p-4">
            <div className="space-y-3">
              {chatMessages.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-8" data-testid="text-chat-empty">
                  Henuz mesaj yok
                </p>
              )}
              {chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.isAdminMessage ? "justify-start" : "justify-end"}`}
                  data-testid={`chat-message-${msg.id}`}
                >
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                      msg.isAdminMessage
                        ? "bg-blue-500/10 dark:bg-blue-500/20 rounded-bl-md"
                        : "bg-primary text-primary-foreground rounded-br-md"
                    }`}
                  >
                    <div className={`text-[10px] font-semibold mb-0.5 ${msg.isAdminMessage ? "text-blue-600 dark:text-blue-400" : "text-primary-foreground/70"}`}>
                      {msg.isAdminMessage ? "Yönetici" : user.fullName}
                    </div>
                    {msg.message && <p className="text-sm whitespace-pre-wrap">{msg.message}</p>}
                    {msg.fileUrl && (
                      <a
                        href={msg.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 mt-1 text-xs underline"
                      >
                        <FileText className="w-3 h-3" />
                        Dosyayı Aç
                      </a>
                    )}
                    <div className={`text-[10px] mt-1 opacity-60`}>
                      {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }) : ""}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
          </ScrollArea>

          <div className="p-3 border-t border-border flex items-center gap-2">
            <input
              ref={chatFileRef}
              type="file"
              className="hidden"
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
              onChange={handleChatFile}
              data-testid="input-operator-chat-file"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => chatFileRef.current?.click()}
              disabled={chatUploading || chatSendMutation.isPending}
              className="shrink-0"
              data-testid="button-operator-chat-attach"
            >
              {chatUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
            </Button>
            <Input
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleChatSend();
                }
              }}
              placeholder="Mesaj yaz..."
              className="flex-1"
              disabled={chatSendMutation.isPending}
              data-testid="input-operator-chat-message"
            />
            <Button
              onClick={handleChatSend}
              disabled={!chatMessage.trim() || chatSendMutation.isPending}
              size="icon"
              className="shrink-0"
              data-testid="button-operator-chat-send"
            >
              {chatSendMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {licenseStatus && (licenseStatus.status === "demo" || licenseStatus.status === "grace") && (
        <div className="max-w-3xl mx-auto w-full px-4 pt-3" data-testid="banner-operator-license-warning">
          <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${
            licenseStatus.status === "grace"
              ? "bg-orange-500/10 border border-orange-500/30 text-orange-700 dark:text-orange-400"
              : "bg-yellow-500/10 border border-yellow-500/30 text-yellow-700 dark:text-yellow-400"
          }`}>
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{licenseStatus.message}</span>
            <span className="ml-auto font-mono font-bold whitespace-nowrap">{licenseStatus.daysRemaining} gun</span>
          </div>
        </div>
      )}

      <div className="flex-1 max-w-3xl mx-auto w-full p-4 space-y-4">

        {step === "setup" && (
          <div className="space-y-4">
            <Card className="border-border/50">
              <CardContent className="p-5 space-y-5">
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    İş Emri
                  </label>
                  <Select value={selectedWorkOrderId} onValueChange={(v) => {
                    setSelectedWorkOrderId(v);
                    setSelectedLineId("");
                    setSelectedOperationId("");
                  }}>
                    <SelectTrigger className="h-16 text-lg" data-testid="select-work-order">
                      <SelectValue placeholder="İş emri seçiniz..." />
                    </SelectTrigger>
                    <SelectContent>
                      {myActiveWorkOrders.length > 0 && (
                        <SelectGroup>
                          <SelectLabel className="text-xs font-bold text-blue-500 uppercase tracking-wider px-2 py-1">
                            Devam Eden İşlerim
                          </SelectLabel>
                          {myActiveWorkOrders.map((wo) => {
                            const { total, done, pct } = getOpProgress(wo);
                            return (
                              <SelectItem key={wo.id} value={String(wo.id)} data-testid={`option-wo-${wo.id}`}>
                                <div className="flex items-center gap-3 py-1 w-full">
                                  <div className="flex flex-col flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono font-bold text-base">{wo.orderNumber}</span>
                                      <span className="text-muted-foreground">|</span>
                                      <span className="text-base truncate">{wo.productName}</span>
                                    </div>
                                    {total > 0 && (
                                      <div className="flex items-center gap-2 mt-1">
                                        <div className="h-1.5 w-20 bg-muted rounded-full overflow-hidden">
                                          <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                                        </div>
                                        <span className="text-xs text-muted-foreground">{done}/{total} Op</span>
                                      </div>
                                    )}
                                  </div>
                                  <Badge variant="secondary" className="text-xs shrink-0">
                                    {wo.targetQuantity} adet
                                  </Badge>
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectGroup>
                      )}
                      {otherWorkOrders.length > 0 && (
                        <SelectGroup>
                          {myActiveWorkOrders.length > 0 && (
                            <SelectLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1">
                              Diğer İş Emirleri
                            </SelectLabel>
                          )}
                          {otherWorkOrders.map((wo) => {
                            const { total, done, pct } = getOpProgress(wo);
                            return (
                              <SelectItem key={wo.id} value={String(wo.id)} data-testid={`option-wo-${wo.id}`}>
                                <div className="flex items-center gap-3 py-1 w-full">
                                  <div className="flex flex-col flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono font-bold text-base">{wo.orderNumber}</span>
                                      <span className="text-muted-foreground">|</span>
                                      <span className="text-base truncate">{wo.productName}</span>
                                    </div>
                                    {total > 0 && (
                                      <div className="flex items-center gap-2 mt-1">
                                        <div className="h-1.5 w-20 bg-muted rounded-full overflow-hidden">
                                          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                                        </div>
                                        <span className="text-xs text-muted-foreground">{done}/{total} Op</span>
                                      </div>
                                    )}
                                  </div>
                                  <Badge variant="secondary" className="text-xs shrink-0">
                                    {wo.targetQuantity} adet
                                  </Badge>
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectGroup>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {selectedWorkOrder && (
                  <div className="rounded-lg bg-muted/40 border border-border/30 p-4">
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Ürün</div>
                        <div className="font-semibold text-sm" data-testid="text-product-name">{selectedWorkOrder.productName}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Hedef</div>
                        <div className="font-mono font-bold text-lg" data-testid="text-target-qty">{selectedWorkOrder.targetQuantity}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Tamamlanan</div>
                        <div className="font-mono font-bold text-lg text-emerald-500" data-testid="text-completed-qty">{selectedWorkOrder.completedQuantity}</div>
                      </div>
                    </div>

                    {allWoAttachments.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-border/30">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full gap-2"
                          onClick={() => setShowPdfModal(true)}
                          data-testid="button-view-pdfs"
                        >
                          <FileText className="w-4 h-4" />
                          PDF Dokumanlari ({allWoAttachments.length})
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {selectedWorkOrderId && woLines && woLines.length > 0 && (
                  <div className="space-y-3">
                    <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                      <Layers className="w-4 h-4" />
                      İş Emri Parçaları
                    </label>
                    <div className="space-y-2">
                      {woLines.map((line) => {
                        const hasAttachments = woAttachments?.some(
                          a => a.workOrderLineId === line.id || !a.workOrderLineId
                        );
                        const progressPct = line.targetQuantity > 0
                          ? Math.round((line.completedQuantity / line.targetQuantity) * 100)
                          : 0;
                        return (
                          <Card
                            key={line.id}
                            className="border-border/50"
                            data-testid={`card-wo-line-${line.id}`}
                          >
                            <CardContent className="p-3">
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <span className="font-mono font-bold text-sm">{line.productCode}</span>
                                  <span className="text-sm text-muted-foreground truncate">{line.productName}</span>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono text-xs text-muted-foreground">
                                    {line.completedQuantity}/{line.targetQuantity} ({progressPct}%)
                                  </span>
                                  <Badge
                                    variant={
                                      line.status === "completed" ? "default" :
                                      line.status === "in_progress" ? "secondary" : "outline"
                                    }
                                    className={
                                      line.status === "completed" ? "bg-emerald-500 text-white" :
                                      line.status === "in_progress" ? "bg-blue-500 text-white" :
                                      "border-amber-500 text-amber-600"
                                    }
                                    data-testid={`text-line-status-${line.id}`}
                                  >
                                    {line.status === "completed" ? "Tamamlandı" :
                                     line.status === "in_progress" ? "Devam Ediyor" : "Bekliyor"}
                                  </Badge>
                                  {hasAttachments && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="gap-1"
                                      onClick={() => {
                                        setPdfFilterLineId(line.id);
                                        setShowPdfModal(true);
                                      }}
                                      data-testid={`button-line-pdf-${line.id}`}
                                    >
                                      <FileText className="w-3.5 h-3.5" />
                                      PDF
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                )}

                {selectedWorkOrderId && activeLines.length > 0 && (
                  <div className="space-y-3">
                    <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                      <Layers className="w-4 h-4" />
                      Parca Secimi
                    </label>
                    <Select value={selectedLineId} onValueChange={setSelectedLineId}>
                      <SelectTrigger className="h-16 text-lg" data-testid="select-work-order-line">
                        <SelectValue placeholder="Parça seçiniz (opsiyonel)..." />
                      </SelectTrigger>
                      <SelectContent>
                        {activeLines.map((line) => (
                          <SelectItem key={line.id} value={String(line.id)} data-testid={`option-line-${line.id}`}>
                            <div className="flex items-center gap-3 py-1">
                              <span className="font-mono font-bold text-sm">{line.productCode}</span>
                              <span className="text-muted-foreground">|</span>
                              <span className="text-sm">{line.productName}</span>
                              <Badge variant="secondary" className="text-xs ml-auto">
                                {line.completedQuantity}/{line.targetQuantity}
                              </Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedLine && (
                      <div className="rounded-md bg-muted/30 p-3 text-sm space-y-1">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Parca:</span>
                          <span className="font-medium">{selectedLine.productCode} - {selectedLine.productName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Hedef / Yapilan:</span>
                          <span className="font-mono font-bold">{selectedLine.completedQuantity} / {selectedLine.targetQuantity}</span>
                        </div>
                        {selectedLine.currentOperation && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Mevcut Op:</span>
                            <span className="font-mono">{selectedLine.currentOperation}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {selectedWorkOrderId && (
                  <div className="space-y-3">
                    <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                      <Cog className="w-4 h-4" />
                      Operasyon
                    </label>
                    <Select value={selectedOperationId} onValueChange={setSelectedOperationId}>
                      <SelectTrigger className="h-16 text-lg" data-testid="select-operation">
                        <SelectValue placeholder="Operasyon seçiniz..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableOperations.map((op) => (
                          <SelectItem
                            key={op.id}
                            value={String(op.id)}
                            disabled={!canDoOnCurrentMachine}
                            data-testid={`option-op-${op.id}`}
                          >
                            <div className="flex items-center gap-3 py-1">
                              <Badge
                                variant="outline"
                                className={`font-mono font-bold text-base px-3 ${!canDoOnCurrentMachine ? "opacity-50" : ""}`}
                              >
                                {op.code}
                              </Badge>
                              <span className={`text-base ${!canDoOnCurrentMachine ? "opacity-50" : ""}`}>{op.name}</span>
                              {!canDoOnCurrentMachine && (
                                <span className="text-xs text-amber-500 ml-1">Başka tezgahta</span>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {availableOperations.length > 0 && !canDoOnCurrentMachine && selectedMachineId && (
                      <p className="text-sm text-amber-500 flex items-center gap-2" data-testid="warning-machine-mismatch">
                        <AlertTriangle className="w-4 h-4" />
                        Bu operasyon seçili tezgahta yapılamaz.
                        {allowedMachineNames ? ` İzin verilen tezgahlar: ${allowedMachineNames}.` : ""}
                      </p>
                    )}
                    {availableOperations.length === 0 && selectedWorkOrderId && (
                      <p className="text-sm text-amber-500 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        {hasNoRoute
                          ? "Varsayılan operasyon rotası tanımlanmamış. Lütfen yöneticiye başvurun."
                          : allOpsCompleted
                          ? "Tüm operasyonlar tamamlandı."
                          : "Bu iş emri için bekleyen operasyon yok."}
                      </p>
                    )}
                  </div>
                )}

                {selectedOperationId && selectedMachineId && (() => {
                  const currentMachine = machines?.find(m => m.id === Number(selectedMachineId));
                  return (
                    <div className="space-y-3">
                      <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                        <Settings2 className="w-4 h-4" />
                        Tezgah
                      </label>
                      <div className="flex items-center gap-3 p-4 bg-muted/40 border border-border/30 rounded-lg" data-testid="text-selected-machine">
                        <Settings2 className="w-5 h-5 text-chart-1 shrink-0" />
                        <span className="font-mono font-bold text-lg">{currentMachine?.code || "-"}</span>
                        <span className="text-muted-foreground">|</span>
                        <span className="text-base">{currentMachine?.name || "-"}</span>
                        <Badge
                          variant={currentMachine?.status === "idle" ? "secondary" : "destructive"}
                          className="text-xs ml-auto"
                        >
                          {currentMachine?.status === "idle" ? "Boşta" : currentMachine?.status === "running" ? "Çalışıyor" : currentMachine?.status === "stopped" ? "Durdu" : "Arıza"}
                        </Badge>
                      </div>
                    </div>
                  );
                })()}

                {selectedOperationId && selectedMachineId && !machineCompatible && (
                  <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg space-y-2" data-testid="alert-machine-incompatible">
                    <p className="text-sm font-semibold text-destructive flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 shrink-0" />
                      Bu operasyon seçili tezgahta yapılamaz. Lütfen yöneticiye başvurun.
                    </p>
                    {allowedMachinesForOp && allowedMachinesForOp.length > 0 && (
                      <p className="text-xs text-muted-foreground ml-7">
                        İzin verilen tezgahlar: <span className="font-mono font-semibold">{allowedMachinesForOp.map(m => m.code).join(", ")}</span>
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Button
              className="w-full h-20 text-2xl font-bold rounded-xl shadow-lg transition-all active:scale-[0.98]"
              style={{ backgroundColor: canProceedToReady ? "hsl(142, 76%, 36%)" : undefined }}
              disabled={!canProceedToReady}
              onClick={() => setStep("ready")}
              data-testid="button-proceed"
            >
              <Play className="w-8 h-8 mr-3" />
              HAZIRIM
            </Button>
          </div>
        )}

        {step === "ready" && (
          <div className="space-y-5">
            <Card className="border-border/50">
              <CardContent className="p-6">
                <div className="text-center space-y-5">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
                    <CircleDot className="w-8 h-8 text-emerald-500" />
                  </div>
                  <h2 className="text-xl font-bold">Üretim Başlatmaya Hazır</h2>
                  <div className="rounded-lg bg-muted/40 border border-border/30 p-4 space-y-3 text-left">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">İş Emri</span>
                      <span className="font-mono font-bold text-base" data-testid="text-ready-wo">{selectedWorkOrder?.orderNumber}</span>
                    </div>
                    <div className="border-t border-border/30" />
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Ürün</span>
                      <span className="font-medium" data-testid="text-ready-product">{selectedWorkOrder?.productName}</span>
                    </div>
                    {selectedLine && (
                      <>
                        <div className="border-t border-border/30" />
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Parca</span>
                          <span className="font-medium text-sm" data-testid="text-ready-line">
                            {selectedLine.productCode} - {selectedLine.productName}
                          </span>
                        </div>
                      </>
                    )}
                    <div className="border-t border-border/30" />
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Operasyon</span>
                      <span className="font-mono font-bold" data-testid="text-ready-operation">
                        {selectedOperation?.code} - {selectedOperation?.name}
                      </span>
                    </div>
                    <div className="border-t border-border/30" />
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Tezgah</span>
                      <span className="font-mono font-bold" data-testid="text-ready-machine">
                        {selectedMachine?.code} - {selectedMachine?.name}
                      </span>
                    </div>
                    <div className="border-t border-border/30" />
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Operator</span>
                      <span className="font-medium" data-testid="text-ready-operator">{user.fullName}</span>
                    </div>
                  </div>

                  {allWoAttachments.length > 0 && (
                    <Button
                      variant="outline"
                      className="w-full gap-2"
                      onClick={() => setShowPdfModal(true)}
                      data-testid="button-view-pdfs-ready"
                    >
                      <FileText className="w-4 h-4" />
                      PDF Dokumanlari ({allWoAttachments.length})
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {currentDrawing && (
              <Card className="border-border/50" data-testid="card-drawing-ready">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold flex items-center gap-2">
                      <ImageIcon className="w-4 h-4" />
                      Teknik Resim
                      <Badge variant="secondary" className="text-xs">Rev.{currentDrawing.revisionNumber}</Badge>
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 text-xs"
                      onClick={() => setShowDrawingFullscreen(true)}
                      data-testid="button-drawing-fullscreen"
                    >
                      <Maximize2 className="w-3 h-3" /> Tam Ekran
                    </Button>
                  </div>
                  <div className="rounded-lg border border-border/30 overflow-hidden bg-muted/20 flex items-center justify-center min-h-[200px]">
                    {isImageFile(currentDrawing.fileName) ? (
                      <img
                        src={currentDrawing.fileUrl}
                        alt={currentDrawing.fileName}
                        className="max-w-full max-h-[300px] object-contain cursor-pointer"
                        onClick={() => setShowDrawingFullscreen(true)}
                        data-testid="img-drawing-ready"
                      />
                    ) : (
                      <a
                        href={currentDrawing.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex flex-col items-center gap-3 p-8 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <FileText className="w-16 h-16 text-red-500" />
                        <span className="text-sm font-medium">{currentDrawing.fileName}</span>
                        <span className="text-xs">PDF görüntülemek için dokunun</span>
                      </a>
                    )}
                  </div>
                  {currentDrawing.revisionNote && (
                    <p className="text-xs text-muted-foreground italic">{currentDrawing.revisionNote}</p>
                  )}
                  {!hasAckedCurrentDrawing && (
                    <Button
                      className="w-full h-14 text-lg font-bold rounded-xl gap-2"
                      variant="outline"
                      style={{ borderColor: "hsl(45, 93%, 47%)", color: "hsl(45, 93%, 37%)" }}
                      onClick={() => acknowledgeMutation.mutate()}
                      disabled={acknowledgeMutation.isPending}
                      data-testid="button-acknowledge-drawing"
                    >
                      <Eye className="w-5 h-5" />
                      {acknowledgeMutation.isPending ? "Onaylanıyor..." : "Revizyonu Gördüm"}
                    </Button>
                  )}
                  {hasAckedCurrentDrawing && (
                    <div className="flex items-center gap-2 text-sm text-emerald-600 justify-center py-1" data-testid="text-drawing-acked">
                      <CheckCircle className="w-4 h-4" />
                      Revizyon onaylandı
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <Button
              className="w-full h-24 text-3xl font-black rounded-xl shadow-lg transition-all active:scale-[0.98]"
              style={{ backgroundColor: (currentDrawing && !hasAckedCurrentDrawing) ? undefined : "hsl(142, 76%, 36%)" }}
              onClick={() => startMutation.mutate()}
              disabled={startMutation.isPending || (currentDrawing ? !hasAckedCurrentDrawing : false)}
              data-testid="button-start"
            >
              <Play className="w-10 h-10 mr-4" />
              {currentDrawing && !hasAckedCurrentDrawing ? "ONAY GEREKLİ" : "BAŞLAT"}
            </Button>

            <Button
              variant="outline"
              className="w-full h-14 text-base"
              onClick={() => setStep("setup")}
              data-testid="button-back-to-setup"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Geri Don
            </Button>
          </div>
        )}

        {(step === "running" || step === "paused") && (
          <div className="space-y-4">
            <div className="rounded-xl border border-border/50 bg-card/80 p-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-3 h-3 rounded-full shrink-0 ${step === "running" ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
                  <div className="min-w-0">
                    <div className="font-mono font-bold text-sm truncate" data-testid="text-active-wo">
                      {selectedWorkOrder?.orderNumber}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {selectedLine ? `${selectedLine.productCode} - ${selectedLine.productName}` : selectedWorkOrder?.productName}
                    </div>
                  </div>
                </div>
                <div className="text-right min-w-0">
                  <div className="font-mono font-bold text-sm" data-testid="text-active-op">
                    {selectedOperation?.code}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {selectedMachine?.code}
                  </div>
                </div>
                <Badge
                  className={`text-sm px-4 py-1.5 shrink-0 ${step === "running"
                    ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/30"
                    : "bg-red-500/15 text-red-500 border-red-500/30"
                  }`}
                  variant="outline"
                  data-testid="badge-status"
                >
                  {step === "running" ? "ÇALIŞIYOR" : "DURDU"}
                </Badge>
              </div>
            </div>

            {allWoAttachments.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2"
                onClick={() => setShowPdfModal(true)}
                data-testid="button-view-pdfs-running"
              >
                <FileText className="w-4 h-4" />
                PDF Dokumanlari ({allWoAttachments.length})
              </Button>
            )}

            {currentDrawing && (
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2"
                onClick={() => setShowDrawingFullscreen(true)}
                data-testid="button-view-drawing-running"
              >
                <ImageIcon className="w-4 h-4" />
                Teknik Resim (Rev.{currentDrawing.revisionNumber})
                {!hasAckedCurrentDrawing && (
                  <Badge variant="destructive" className="text-[10px] px-1.5 ml-1">YENI</Badge>
                )}
              </Button>
            )}

            <Card className="border-border/50 overflow-hidden">
              <CardContent className="p-0">
                <div className={`py-10 px-6 text-center transition-colors ${step === "running" ? "bg-emerald-500/5" : "bg-red-500/5"}`}>
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <Timer className={`w-6 h-6 ${step === "running" ? "text-emerald-500" : "text-red-500"}`} />
                    <span className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                      Gecen Sure
                    </span>
                  </div>
                  <div
                    className="font-mono font-black text-7xl tracking-wider tabular-nums"
                    data-testid="text-timer"
                  >
                    {formatTime(elapsedSeconds)}
                  </div>
                </div>
                <div className="border-t border-border/30 p-4">
                  <div className="flex items-center justify-center gap-6">
                    <div className="text-center">
                      <div className="text-xs text-muted-foreground mb-1">Üretilen</div>
                      <div className="font-mono font-bold text-2xl text-emerald-500" data-testid="text-total-produced">
                        {totalProduced}
                      </div>
                    </div>
                    <div className="w-px h-8 bg-border/50" />
                    <div className="text-center">
                      <div className="text-xs text-muted-foreground mb-1">Hedef</div>
                      <div className="font-mono font-bold text-2xl" data-testid="text-target">
                        {selectedLine?.targetQuantity || selectedWorkOrder?.targetQuantity}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {step === "running" && (
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="destructive"
                  className="h-24 text-xl font-black rounded-xl shadow-lg transition-all active:scale-[0.98] flex flex-col items-center justify-center gap-2"
                  onClick={() => {
                    setSelectedStopReasonId("");
                    setQuantityInput("");
                    setAcceptedQuantityInput("");
                    setStopModalStep("reason");
                    setShowStopModal(true);
                  }}
                  data-testid="button-stop"
                >
                  <Pause className="w-10 h-10" />
                  DURDUR
                </Button>
                <Button
                  className="h-24 text-xl font-black rounded-xl shadow-lg transition-all active:scale-[0.98] flex flex-col items-center justify-center gap-2"
                  style={{ backgroundColor: "hsl(217, 91%, 40%)" }}
                  onClick={() => {
                    setQuantityInput(remainingQuantity > 0 ? String(remainingQuantity) : "0");
                    setAcceptedQuantityInput("");
                    setShowFinishModal(true);
                  }}
                  data-testid="button-finish"
                >
                  <Flag className="w-10 h-10" />
                  BITIR
                </Button>
              </div>
            )}

            {step === "paused" && (
              <div className="space-y-3">
                <Button
                  className="w-full h-24 text-3xl font-black rounded-xl shadow-lg transition-all active:scale-[0.98]"
                  style={{ backgroundColor: "hsl(142, 76%, 36%)" }}
                  onClick={() => resumeMutation.mutate()}
                  disabled={resumeMutation.isPending}
                  data-testid="button-resume"
                >
                  <RotateCcw className="w-10 h-10 mr-4" />
                  {resumeMutation.isPending ? "BAŞLATILIYOR..." : "DEVAM ET"}
                </Button>
                <Button
                  className="w-full h-16 text-lg font-bold rounded-xl shadow-lg transition-all active:scale-[0.98]"
                  style={{ backgroundColor: "hsl(217, 91%, 40%)" }}
                  onClick={() => {
                    setQuantityInput(remainingQuantity > 0 ? String(remainingQuantity) : "0");
                    setAcceptedQuantityInput("");
                    setShowFinishModal(true);
                  }}
                  data-testid="button-finish-paused"
                >
                  <Flag className="w-7 h-7 mr-3" />
                  OPERASYONU BITIR
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <Dialog open={showStopModal} onOpenChange={(open) => {
        if (!open) {
          setShowStopModal(false);
          setStopModalStep("reason");
          setSelectedStopReasonId("");
          setQuantityInput("");
          setAcceptedQuantityInput("");
        }
      }}>
        <DialogContent className="max-w-md">
          {stopModalStep === "reason" && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-xl">
                  <AlertTriangle className="w-6 h-6 text-destructive" />
                  Neden Durduruyorsunuz?
                </DialogTitle>
                <DialogDescription>Üretimi durdurmak için bir neden belirleyin.</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-3 py-2">
                {stopReasons?.map((reason) => (
                  <Button
                    key={reason.id}
                    variant={selectedStopReasonId === String(reason.id) ? "default" : "outline"}
                    className={`h-20 text-lg font-bold rounded-xl transition-all ${
                      selectedStopReasonId === String(reason.id)
                        ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                        : ""
                    }`}
                    onClick={() => setSelectedStopReasonId(String(reason.id))}
                    data-testid={`button-reason-${reason.id}`}
                  >
                    {reason.name}
                  </Button>
                ))}
              </div>
              <DialogFooter>
                <Button
                  variant="destructive"
                  className="w-full h-16 text-lg font-bold rounded-xl"
                  disabled={!selectedStopReasonId}
                  onClick={handleStopReasonSelected}
                  data-testid="button-next-quantity"
                >
                  Devam Et
                </Button>
              </DialogFooter>
            </>
          )}

          {stopModalStep === "quantity" && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-xl">
                  <Package className="w-6 h-6 text-emerald-500" />
                  Üretilen Adet
                </DialogTitle>
                <DialogDescription>Şu ana kadar kaç adet parça işlediniz?</DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <span className="text-sm font-medium text-muted-foreground">Kalan:</span>
                  <span className={`text-lg font-mono font-bold ${remainingQuantity === 0 ? "text-red-500" : "text-emerald-600 dark:text-emerald-400"}`} data-testid="text-remaining-stop">
                    {remainingQuantity} adet
                  </span>
                </div>
                <Input
                  type="number"
                  min="0"
                  max={remainingQuantity}
                  inputMode="numeric"
                  value={quantityInput}
                  onChange={(e) => setQuantityInput(e.target.value)}
                  placeholder="0"
                  className={`h-20 text-4xl text-center font-mono font-bold rounded-xl ${isQuantityOverLimit ? "border-red-500 border-2 ring-red-500 focus-visible:ring-red-500" : ""} ${isJobComplete ? "opacity-50" : ""}`}
                  data-testid="input-stop-quantity"
                  autoFocus
                  disabled={isJobComplete}
                />
                {isJobComplete && (
                  <p className="text-sm text-amber-600 font-semibold text-center mt-2" data-testid="text-job-complete-stop">
                    Tum adetler tamamlandı. Adet girmeden oturumu kapatabilirsiniz.
                  </p>
                )}
                {isQuantityOverLimit && !isJobComplete && (
                  <p className="text-sm text-red-500 font-semibold text-center mt-2" data-testid="text-over-limit-stop">
                    Hata: Maksimum {remainingQuantity} adet daha girebilirsiniz!
                  </p>
                )}
                {totalProduced > 0 && (
                  <p className="text-sm text-muted-foreground text-center mt-3">
                    Daha once kaydedilen: <span className="font-mono font-bold text-foreground">{totalProduced}</span> adet
                  </p>
                )}

                {!isJobComplete && (
                  <div className="mt-4 p-3 bg-muted/50 rounded-xl">
                    <label className="text-sm font-medium mb-2 block">Kabul Edilen Adet</label>
                    <Input
                      type="number"
                      min="0"
                      inputMode="numeric"
                      value={acceptedQuantityInput}
                      onChange={(e) => setAcceptedQuantityInput(e.target.value)}
                      placeholder={quantityInput || "0"}
                      className="h-12 text-2xl text-center font-mono font-bold rounded-xl"
                      data-testid="input-stop-accepted-quantity"
                    />
                    {(() => {
                      const produced = parseInt(quantityInput) || 0;
                      const accepted = acceptedQuantityInput !== "" ? parseInt(acceptedQuantityInput) : produced;
                      const scrap = produced - accepted;
                      return scrap > 0 ? (
                        <p className="text-sm text-orange-600 font-semibold text-center mt-2" data-testid="text-scrap-stop">
                          Fire: {scrap} adet ({produced > 0 ? ((scrap / produced) * 100).toFixed(1) : 0}%)
                        </p>
                      ) : null;
                    })()}
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button
                  variant="destructive"
                  className="w-full h-16 text-lg font-bold rounded-xl"
                  disabled={stopMutation.isPending || (isQuantityOverLimit && !isJobComplete)}
                  onClick={handleStopConfirm}
                  data-testid="button-confirm-stop"
                >
                  {stopMutation.isPending ? "Kaydediliyor..." : "Kaydet ve Durdur"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showFinishModal} onOpenChange={setShowFinishModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <CheckCircle className="w-6 h-6 text-blue-500" />
              Operasyonu Tamamla
            </DialogTitle>
            <DialogDescription>Operasyonu kapatmak için son üretim adedini giriniz.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-center justify-center gap-2 mb-3">
              <span className="text-sm font-medium text-muted-foreground">Kalan:</span>
              <span className={`text-lg font-mono font-bold ${remainingQuantity === 0 ? "text-red-500" : "text-emerald-600 dark:text-emerald-400"}`} data-testid="text-remaining-finish">
                {remainingQuantity} adet
              </span>
            </div>
            <Input
              type="number"
              min="0"
              max={remainingQuantity}
              inputMode="numeric"
              value={quantityInput}
              onChange={(e) => setQuantityInput(e.target.value)}
              placeholder="0"
              className={`h-20 text-4xl text-center font-mono font-bold rounded-xl ${isQuantityOverLimit ? "border-red-500 border-2 ring-red-500 focus-visible:ring-red-500" : ""} ${isJobComplete ? "opacity-50" : ""}`}
              data-testid="input-finish-quantity"
              autoFocus
              disabled={isJobComplete}
            />
            {isJobComplete && (
              <p className="text-sm text-amber-600 font-semibold text-center mt-2" data-testid="text-job-complete-finish">
                Tum adetler tamamlandı. Adet girmeden operasyonu kapatabilirsiniz.
              </p>
            )}
            {isQuantityOverLimit && !isJobComplete && (
              <p className="text-sm text-red-500 font-semibold text-center mt-2" data-testid="text-over-limit-finish">
                Hata: Maksimum {remainingQuantity} adet daha girebilirsiniz!
              </p>
            )}
            {totalProduced > 0 && (
              <p className="text-sm text-muted-foreground text-center mt-3">
                Daha once kaydedilen: <span className="font-mono font-bold text-foreground">{totalProduced}</span> adet
              </p>
            )}

            {!isJobComplete && (
              <div className="mt-4 p-3 bg-muted/50 rounded-xl">
                <label className="text-sm font-medium mb-2 block">Kabul Edilen Adet</label>
                <Input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={acceptedQuantityInput}
                  onChange={(e) => setAcceptedQuantityInput(e.target.value)}
                  placeholder={quantityInput || "0"}
                  className="h-12 text-2xl text-center font-mono font-bold rounded-xl"
                  data-testid="input-finish-accepted-quantity"
                />
                {(() => {
                  const produced = parseInt(quantityInput) || 0;
                  const accepted = acceptedQuantityInput !== "" ? parseInt(acceptedQuantityInput) : produced;
                  const scrap = produced - accepted;
                  return scrap > 0 ? (
                    <p className="text-sm text-orange-600 font-semibold text-center mt-2" data-testid="text-scrap-finish">
                      Fire: {scrap} adet ({produced > 0 ? ((scrap / produced) * 100).toFixed(1) : 0}%)
                    </p>
                  ) : null;
                })()}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              className="w-full h-16 text-lg font-bold rounded-xl"
              style={{ backgroundColor: "hsl(217, 91%, 40%)" }}
              disabled={finishMutation.isPending || (isQuantityOverLimit && !isJobComplete)}
              onClick={handleFinishConfirm}
              data-testid="button-confirm-finish"
            >
              {finishMutation.isPending ? "Tamamlanıyor..." : "Operasyonu Tamamla"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPdfModal} onOpenChange={(open) => {
        setShowPdfModal(open);
        if (!open) setPdfFilterLineId(null);
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              PDF Dokumanlari
            </DialogTitle>
            <DialogDescription>
              {selectedWorkOrder?.orderNumber} - {selectedWorkOrder?.productName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2 max-h-[60vh] overflow-y-auto">
            {(() => {
              const filteredAttachments = pdfFilterLineId !== null
                ? allWoAttachments.filter(a => a.workOrderLineId === pdfFilterLineId || !a.workOrderLineId)
                : allWoAttachments;
              return filteredAttachments.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Bu iş emrine ait dokümanlar bulunamadı.
              </p>
            ) : (
              <>
                {filteredAttachments.filter(a => !a.workOrderLineId).length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      İş Emri Dokümanları
                    </p>
                    {filteredAttachments.filter(a => !a.workOrderLineId).map((att) => (
                      <a
                        key={att.id}
                        href={att.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors"
                        data-testid={`link-attachment-${att.id}`}
                      >
                        <FileText className="w-5 h-5 text-red-500 shrink-0" />
                        <span className="flex-1 text-sm font-medium truncate">{att.fileName}</span>
                        <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0" />
                      </a>
                    ))}
                  </div>
                )}
                {(() => {
                  const lineIds = [...new Set(filteredAttachments.filter(a => a.workOrderLineId).map(a => a.workOrderLineId))];
                  if (lineIds.length === 0) return null;
                  return lineIds.map(lineId => {
                    const line = woLines?.find(l => l.id === lineId);
                    const lineAtts = filteredAttachments.filter(a => a.workOrderLineId === lineId);
                    return (
                      <div key={lineId} className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-3">
                          {line ? `${line.productCode} - ${line.productName}` : `Parca #${lineId}`}
                        </p>
                        {lineAtts.map((att) => (
                          <a
                            key={att.id}
                            href={att.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors"
                            data-testid={`link-attachment-${att.id}`}
                          >
                            <FileText className="w-5 h-5 text-red-500 shrink-0" />
                            <span className="flex-1 text-sm font-medium truncate">{att.fileName}</span>
                            <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0" />
                          </a>
                        ))}
                      </div>
                    );
                  });
                })()}
              </>
            );
            })()}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showDrawingFullscreen} onOpenChange={setShowDrawingFullscreen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ImageIcon className="w-5 h-5" />
              Teknik Resim
              {currentDrawing && (
                <Badge variant="secondary">Rev.{currentDrawing.revisionNumber}</Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              {currentDrawing?.fileName}
              {currentDrawing?.revisionNote && ` - ${currentDrawing.revisionNote}`}
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center overflow-auto max-h-[65vh] bg-muted/10 rounded-lg border border-border/30">
            {currentDrawing && isImageFile(currentDrawing.fileName) ? (
              <img
                src={currentDrawing.fileUrl}
                alt={currentDrawing.fileName}
                className="max-w-full max-h-[60vh] object-contain"
                data-testid="img-drawing-fullscreen"
              />
            ) : currentDrawing ? (
              <iframe
                src={currentDrawing.fileUrl}
                className="w-full h-[60vh]"
                title={currentDrawing.fileName}
                data-testid="iframe-drawing-fullscreen"
              />
            ) : null}
          </div>
          {currentDrawing && !hasAckedCurrentDrawing && (
            <DialogFooter>
              <Button
                className="w-full h-14 text-lg font-bold rounded-xl gap-2"
                onClick={() => {
                  acknowledgeMutation.mutate();
                  setShowDrawingFullscreen(false);
                }}
                disabled={acknowledgeMutation.isPending}
                data-testid="button-acknowledge-drawing-fullscreen"
              >
                <Eye className="w-5 h-5" />
                {acknowledgeMutation.isPending ? "Onaylanıyor..." : "Revizyonu Gördüm"}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showTakeoverModal} onOpenChange={(open) => {
        if (!open) {
          setShowTakeoverModal(false);
          setTakeoverLogData(null);
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <RotateCcw className="w-5 h-5 text-orange-500" />
              Vardiya Devralma
            </DialogTitle>
            <DialogDescription>
              Bu tezgahta başka bir operatör tarafından başlatılmış aktif bir iş bulunmaktadır.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            {takeoverLogData && (
              <div className="rounded-lg border border-border/50 p-4 bg-muted/20 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Package className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">
                    İş Emri: {workOrders?.find(w => w.id === takeoverLogData.workOrderId)?.orderNumber || `#${takeoverLogData.workOrderId}`}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Cog className="w-4 h-4 text-muted-foreground" />
                  <span>
                    Operasyon: {allOperations?.find(o => o.id === takeoverLogData.operationId)?.name || `#${takeoverLogData.operationId}`}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span>
                    Durum: {takeoverLogData.status === "running" ? "Çalışıyor" : "Duraklatıldı"}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Flag className="w-4 h-4 text-muted-foreground" />
                  <span>
                    Üretilen: {takeoverLogData.producedQuantity || 0} adet
                  </span>
                </div>
              </div>
            )}
            <p className="text-sm font-medium text-center">Bu işi devralmak istiyor musunuz?</p>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setShowTakeoverModal(false);
                setTakeoverLogData(null);
              }}
              className="h-12"
              data-testid="button-cancel-takeover"
            >
              Hayir, Vazgec
            </Button>
            <Button
              onClick={() => {
                if (machineIdForActiveCheck) {
                  takeoverMutation.mutate(Number(machineIdForActiveCheck));
                }
              }}
              disabled={takeoverMutation.isPending}
              className="h-12 bg-orange-600 hover:bg-orange-700 text-white"
              data-testid="button-confirm-takeover"
            >
              {takeoverMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Devralınıyor...
                </>
              ) : (
                <>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Evet, Devral
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
