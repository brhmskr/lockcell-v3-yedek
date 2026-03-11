import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  Send, MessageSquare, Users, Settings2, Paperclip, FileText, Image,
  Loader2, Radio,
} from "lucide-react";
import type { Machine, ChatMessage, User } from "@shared/schema";

interface MachineChatProps {
  globalUnreadCounts?: Record<number, number>;
}

export default function MachineChat({ globalUnreadCounts }: MachineChatProps = {}) {
  const { toast } = useToast();
  const [selectedMachineId, setSelectedMachineId] = useState<number | null>(null);
  const [isBroadcast, setIsBroadcast] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: machines = [] } = useQuery<Machine[]>({ queryKey: ["/api/machines"] });
  const { data: users = [] } = useQuery<User[]>({ queryKey: ["/api/users"] });
  const unreadCounts = globalUnreadCounts || {};

  const { data: messages = [], refetch: refetchMessages } = useQuery<ChatMessage[]>({
    queryKey: ["/api/chat", selectedMachineId],
    enabled: !!selectedMachineId && !isBroadcast,
    refetchInterval: 3000,
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (selectedMachineId && !isBroadcast) {
      apiRequest("POST", `/api/chat/mark-read/${selectedMachineId}`, {}).then(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/chat/unread-counts"] });
      }).catch(() => {});
    }
  }, [selectedMachineId, isBroadcast, messages.length]);

  const sendMutation = useMutation({
    mutationFn: async (data: { message?: string; fileUrl?: string }) => {
      if (isBroadcast) {
        await apiRequest("POST", "/api/chat/broadcast", data);
      } else {
        await apiRequest("POST", `/api/chat/${selectedMachineId}`, data);
      }
    },
    onSuccess: () => {
      setMessageText("");
      if (!isBroadcast && selectedMachineId) {
        queryClient.invalidateQueries({ queryKey: ["/api/chat", selectedMachineId] });
      }
      if (isBroadcast) {
        toast({ title: "Toplu mesaj gönderildi" });
      }
    },
    onError: (err: Error) => {
      toast({ title: "Hata", description: err.message, variant: "destructive" });
    },
  });

  const handleSend = () => {
    const trimmed = messageText.trim();
    if (!trimmed) return;
    if (!isBroadcast && !selectedMachineId) return;
    sendMutation.mutate({ message: trimmed });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!isBroadcast && !selectedMachineId) return;

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({ title: "Dosya çok büyük", description: "Maksimum 10MB yüklenebilir", variant: "destructive" });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setUploading(true);
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
      sendMutation.mutate({ message: `Dosya: ${file.name}`, fileUrl });
    } catch {
      toast({ title: "Dosya yüklenemedi", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const selectMachine = (id: number) => {
    setSelectedMachineId(id);
    setIsBroadcast(false);
  };

  const selectBroadcast = () => {
    setSelectedMachineId(null);
    setIsBroadcast(true);
  };

  const getUserName = (userId: number) => {
    const user = users.find(u => u.id === userId);
    return user?.fullName || `Kullanıcı #${userId}`;
  };

  const getMachineName = (id: number) => {
    const m = machines.find(m => m.id === id);
    return m ? `${m.name} (${m.code})` : `Tezgah #${id}`;
  };

  const formatTime = (dateStr: string | Date | null) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit" }) + " " +
      d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  };

  const isFileMessage = (msg: ChatMessage) => !!msg.fileUrl;

  const renderFilePreview = (msg: ChatMessage) => {
    if (!msg.fileUrl) return null;
    const fileName = msg.message?.replace("Dosya: ", "") || "";
    const ext = fileName.split(".").pop()?.toLowerCase() || "";
    const isImage = ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"].includes(ext);

    if (isImage) {
      return (
        <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer" className="block mt-1">
          <img src={msg.fileUrl} alt={fileName} className="max-w-[200px] max-h-[150px] rounded-lg object-cover" />
        </a>
      );
    }

    return (
      <a
        href={msg.fileUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 mt-1 text-xs underline text-blue-400 hover:text-blue-300"
      >
        <FileText className="w-4 h-4" />
        {fileName || "Dosyayı Aç"}
      </a>
    );
  };

  return (
    <div className="flex gap-4 h-[calc(100vh-200px)] min-h-[500px]" data-testid="machine-chat-container">
      <Card className="w-64 shrink-0">
        <CardContent className="p-0">
          <div className="p-3 border-b border-border">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Settings2 className="w-4 h-4" />
              Tezgahlar
            </h3>
          </div>
          <ScrollArea className="h-[calc(100vh-280px)]">
            <div className="p-2 space-y-1">
              <button
                onClick={selectBroadcast}
                className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-all ${
                  isBroadcast
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "hover:bg-muted text-muted-foreground hover:text-foreground"
                }`}
                data-testid="button-broadcast"
              >
                <Radio className="w-4 h-4" />
                <span className="font-medium">Tum Tezgahlar</span>
              </button>

              {machines.map((machine) => (
                <button
                  key={machine.id}
                  onClick={() => selectMachine(machine.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-all ${
                    selectedMachineId === machine.id && !isBroadcast
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "hover:bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                  data-testid={`button-machine-chat-${machine.id}`}
                >
                  <Settings2 className="w-4 h-4" />
                  <span className="truncate">{machine.name}</span>
                  <Badge variant="outline" className="ml-auto text-[10px] px-1.5">
                    {machine.code}
                  </Badge>
                  {(unreadCounts[machine.id] || 0) > 0 && (
                    <Badge className="bg-red-500 text-white text-[10px] px-1.5 min-w-[20px] text-center" data-testid={`badge-unread-${machine.id}`}>
                      {unreadCounts[machine.id]}
                    </Badge>
                  )}
                </button>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card className="flex-1 flex flex-col">
        <CardContent className="p-0 flex flex-col h-full">
          <div className="p-3 border-b border-border flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm">
              {isBroadcast
                ? "Toplu Mesaj - Tüm Tezgahlar"
                : selectedMachineId
                  ? getMachineName(selectedMachineId)
                  : "Bir tezgah seçin"}
            </h3>
          </div>

          {!selectedMachineId && !isBroadcast ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Sol panelden bir tezgah seçin veya toplu mesaj gönderin</p>
              </div>
            </div>
          ) : isBroadcast ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Radio className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Aşağıdaki alana yazdığınız mesaj tüm tezgahlara gönderilecek</p>
                <p className="text-xs mt-1 text-muted-foreground/70">{machines.length} tezgah</p>
              </div>
            </div>
          ) : (
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-3">
                {messages.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-8">
                    Henuz mesaj yok
                  </p>
                )}
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.isAdminMessage ? "justify-end" : "justify-start"}`}
                    data-testid={`chat-message-${msg.id}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                        msg.isAdminMessage
                          ? "bg-primary text-primary-foreground rounded-br-md"
                          : "bg-muted rounded-bl-md"
                      }`}
                    >
                      <div className={`text-[10px] font-medium mb-0.5 ${msg.isAdminMessage ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                        {getUserName(msg.userId)}
                      </div>
                      {msg.message && <p className="text-sm whitespace-pre-wrap">{msg.message}</p>}
                      {renderFilePreview(msg)}
                      <div className={`text-[10px] mt-1 ${msg.isAdminMessage ? "text-primary-foreground/60" : "text-muted-foreground/60"}`}>
                        {formatTime(msg.createdAt)}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>
          )}

          {(selectedMachineId || isBroadcast) && (
            <div className="p-3 border-t border-border flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                onChange={handleFileUpload}
                data-testid="input-chat-file"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || sendMutation.isPending}
                className="shrink-0"
                data-testid="button-chat-attach"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
              </Button>
              <Input
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isBroadcast ? "Tüm tezgahlara mesaj yaz..." : "Mesaj yaz..."}
                className="flex-1"
                disabled={sendMutation.isPending}
                data-testid="input-chat-message"
              />
              <Button
                onClick={handleSend}
                disabled={!messageText.trim() || sendMutation.isPending}
                size="icon"
                className="shrink-0"
                data-testid="button-chat-send"
              >
                {sendMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
