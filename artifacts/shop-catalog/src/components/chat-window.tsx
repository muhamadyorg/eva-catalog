import {
  useEffect, useRef, useState, useLayoutEffect,
} from "react";
import { useAuth } from "./auth-provider";
import { useWebSocket } from "@/hooks/use-websocket";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { ScrollArea } from "./ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  Send, Paperclip, Mic, MicOff, Pencil, Trash2, X, Play, Pause,
  FileText, Check,
} from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

export interface ChatMessage {
  id: number;
  conversationId: number;
  senderId: number;
  type: string;
  content: string | null;
  fileUrl: string | null;
  fileName: string | null;
  fileSize: number | null;
  duration: number | null;
  isEdited: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

type SendFn = (data: FormData | { content: string }) => Promise<Response>;
type EditFn = (id: number, content: string) => Promise<void>;
type DeleteFn = (id: number) => Promise<void>;

interface Props {
  conversationId: number;
  messages: ChatMessage[];
  onSend: SendFn;
  onEdit: EditFn;
  onDelete: DeleteFn;
  isLoading?: boolean;
  recipientName?: string;
}

const CACHE_KEY = (id: number) => `chat_messages_${id}`;

function formatTime(date: string) {
  const d = new Date(date);
  if (isToday(d)) return format(d, "HH:mm");
  if (isYesterday(d)) return `Kecha ${format(d, "HH:mm")}`;
  return format(d, "dd.MM HH:mm");
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AudioPlayer({ url, duration }: { url: string; duration?: number | null }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const toggle = () => {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); } else { audioRef.current.play(); }
  };

  return (
    <div className="flex items-center gap-2 min-w-[160px]">
      <audio
        ref={audioRef}
        src={url}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setProgress(0); }}
        onTimeUpdate={() => {
          if (!audioRef.current) return;
          setCurrentTime(audioRef.current.currentTime);
          if (audioRef.current.duration) {
            setProgress((audioRef.current.currentTime / audioRef.current.duration) * 100);
          }
        }}
      />
      <Button size="icon" variant="ghost" className="h-8 w-8 flex-shrink-0" onClick={toggle}>
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </Button>
      <div className="flex-1">
        <div className="w-full bg-primary/20 rounded-full h-1.5 cursor-pointer">
          <div className="bg-primary h-1.5 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {playing ? `${Math.floor(currentTime)}s` : (duration ? `${duration}s` : "")}
        </p>
      </div>
    </div>
  );
}

function MessageBubble({
  msg, isMine, onEdit, onDelete,
}: {
  msg: ChatMessage;
  isMine: boolean;
  onEdit: (id: number, content: string) => void;
  onDelete: (id: number) => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(msg.content || "");

  if (msg.isDeleted) {
    return (
      <div className={cn("flex", isMine ? "justify-end" : "justify-start")}>
        <div className="text-xs text-muted-foreground italic px-3 py-2">
          Xabar o'chirildi
        </div>
      </div>
    );
  }

  const handleEditSubmit = () => {
    if (editText.trim()) {
      onEdit(msg.id, editText.trim());
    }
    setEditing(false);
  };

  const fileUrl = msg.fileUrl ? `${BASE_URL}${msg.fileUrl}` : null;

  const renderContent = () => {
    if (msg.type === "image" && fileUrl) {
      return (
        <a href={fileUrl} target="_blank" rel="noopener noreferrer">
          <img
            src={fileUrl}
            alt={msg.fileName || "rasm"}
            className="max-w-[200px] max-h-[200px] rounded-lg object-cover"
            loading="lazy"
          />
        </a>
      );
    }
    if (msg.type === "video" && fileUrl) {
      return (
        <video
          src={fileUrl}
          controls
          className="max-w-[240px] max-h-[180px] rounded-lg"
        />
      );
    }
    if (msg.type === "audio" && fileUrl) {
      return <AudioPlayer url={fileUrl} duration={msg.duration} />;
    }
    if ((msg.type === "file" || msg.type === "voice") && fileUrl) {
      if (msg.type === "voice") {
        return <AudioPlayer url={fileUrl} duration={msg.duration} />;
      }
      return (
        <a
          href={fileUrl}
          download={msg.fileName || true}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <FileText className="h-5 w-5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium truncate max-w-[160px]">{msg.fileName}</p>
            {msg.fileSize && <p className="text-xs opacity-70">{formatFileSize(msg.fileSize)}</p>}
          </div>
        </a>
      );
    }
    if (editing) {
      return (
        <div className="flex gap-2 items-center">
          <Input
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            className="h-7 text-sm min-w-[120px]"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleEditSubmit();
              if (e.key === "Escape") setEditing(false);
            }}
            autoFocus
          />
          <Button size="icon" className="h-7 w-7" onClick={handleEditSubmit}>
            <Check className="h-3 w-3" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(false)}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      );
    }
    return (
      <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
    );
  };

  return (
    <div
      className={cn("flex group", isMine ? "justify-end" : "justify-start")}
      onMouseLeave={() => setShowMenu(false)}
    >
      <div className={cn("relative max-w-[75%]")}>
        <div
          className={cn(
            "rounded-2xl px-3 py-2 shadow-sm",
            isMine
              ? "bg-primary text-primary-foreground rounded-tr-sm"
              : "bg-card border border-border rounded-tl-sm",
          )}
          onDoubleClick={() => {
            if (isMine && msg.type === "text") setEditing(true);
          }}
        >
          {renderContent()}
          <div className={cn("flex items-center gap-1 mt-0.5", isMine ? "justify-end" : "justify-start")}>
            <span className={cn("text-[10px]", isMine ? "text-primary-foreground/60" : "text-muted-foreground")}>
              {formatTime(msg.createdAt)}
            </span>
            {msg.isEdited && (
              <span className={cn("text-[10px]", isMine ? "text-primary-foreground/60" : "text-muted-foreground")}>
                · tahrirlangan
              </span>
            )}
          </div>
        </div>

        {isMine && !editing && (
          <div className={cn(
            "absolute top-0 right-full mr-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity",
          )}>
            {msg.type === "text" && (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-muted-foreground"
                onClick={() => { setEditing(true); setEditText(msg.content || ""); }}
              >
                <Pencil className="h-3 w-3" />
              </Button>
            )}
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-destructive"
              onClick={() => {
                if (window.confirm("Xabarni o'chirasizmi? Bu ikki tomondan ham o'chadi.")) {
                  onDelete(msg.id);
                }
              }}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export function ChatWindow({
  conversationId, messages: initialMessages, onSend, onEdit, onDelete, isLoading, recipientName,
}: Props) {
  const { user } = useAuth();
  const { addListener } = useWebSocket(user?.id, user?.role);

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY(conversationId));
      if (cached) {
        const parsed = JSON.parse(cached) as ChatMessage[];
        return parsed;
      }
    } catch { /* */ }
    return initialMessages;
  });

  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => {
    if (initialMessages.length > 0) {
      setMessages(initialMessages);
    }
  }, [initialMessages]);

  useEffect(() => {
    try {
      localStorage.setItem(CACHE_KEY(conversationId), JSON.stringify(messages));
    } catch { /* */ }
  }, [messages, conversationId]);

  useLayoutEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    const unsub = addListener((data) => {
      if (data.type === "chat_message") {
        const msg = data.message as ChatMessage;
        if (msg.conversationId !== conversationId) return;
        setMessages((prev) => {
          if (prev.find((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      }
      if (data.type === "message_edited") {
        const msg = data.message as ChatMessage;
        if (msg.conversationId !== conversationId) return;
        setMessages((prev) => prev.map((m) => m.id === msg.id ? msg : m));
      }
      if (data.type === "message_deleted") {
        const msg = data.message as ChatMessage;
        if (msg.conversationId !== conversationId) return;
        setMessages((prev) => prev.map((m) => m.id === msg.id ? msg : m));
      }
    });
    return unsub;
  }, [addListener, conversationId]);

  const sendText = async () => {
    if (!text.trim()) return;
    setSending(true);
    const t = text.trim();
    setText("");
    try {
      const res = await onSend({ content: t });
      if (res.ok) {
        const msg: ChatMessage = await res.json();
        setMessages((prev) => {
          if (prev.find((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      }
    } finally {
      setSending(false);
    }
  };

  const sendFile = async (file: File) => {
    setSending(true);
    const fd = new FormData();
    fd.append("file", file);
    const mime = file.type;
    const type = mime.startsWith("image/") ? "image"
      : mime.startsWith("video/") ? "video"
      : mime.startsWith("audio/") ? "audio"
      : "file";
    fd.append("type", type);
    try {
      const res = await onSend(fd);
      if (res.ok) {
        const msg: ChatMessage = await res.json();
        setMessages((prev) => {
          if (prev.find((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      }
    } finally {
      setSending(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.start();
      setRecording(true);
      setRecordingTime(0);
      recordTimerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
    } catch {
      alert("Mikrofonga ruxsat yo'q");
    }
  };

  const stopRecording = () => {
    const mr = mediaRecorderRef.current;
    if (!mr) return;
    clearInterval(recordTimerRef.current);
    mr.onstop = async () => {
      const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
      const file = new File([blob], `voice_${Date.now()}.webm`, { type: "audio/webm" });
      const fd = new FormData();
      fd.append("file", file);
      fd.append("type", "voice");
      fd.append("duration", String(recordingTime));
      setSending(true);
      try {
        const res = await onSend(fd);
        if (res.ok) {
          const msg: ChatMessage = await res.json();
          setMessages((prev) => {
            if (prev.find((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
        }
      } finally {
        setSending(false);
      }
      mr.stream.getTracks().forEach((t) => t.stop());
    };
    mr.stop();
    setRecording(false);
  };

  const handleEdit = async (id: number, content: string) => {
    await onEdit(id, content);
    setMessages((prev) => prev.map((m) => m.id === id ? { ...m, content, isEdited: true } : m));
  };

  const handleDelete = async (id: number) => {
    await onDelete(id);
    setMessages((prev) => prev.map((m) => m.id === id ? { ...m, isDeleted: true } : m));
  };

  const groupedMessages = messages.reduce<{ date: string; msgs: ChatMessage[] }[]>((acc, msg) => {
    const d = format(new Date(msg.createdAt), "yyyy-MM-dd");
    const last = acc[acc.length - 1];
    if (last && last.date === d) { last.msgs.push(msg); }
    else { acc.push({ date: d, msgs: [msg] }); }
    return acc;
  }, []);

  return (
    <div className="flex flex-col h-full">
      {recipientName && (
        <div className="px-4 py-3 border-b border-border bg-card/50 flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-medium">
            {recipientName[0]?.toUpperCase()}
          </div>
          <div>
            <p className="font-medium text-sm">{recipientName}</p>
            <p className="text-xs text-muted-foreground">Online</p>
          </div>
        </div>
      )}

      <ScrollArea className="flex-1 px-4">
        <div className="py-4 space-y-1">
          {isLoading && (
            <p className="text-center text-muted-foreground text-sm py-8">Yuklanmoqda...</p>
          )}
          {!isLoading && messages.length === 0 && (
            <div className="text-center text-muted-foreground py-12">
              <p className="text-4xl mb-2">💬</p>
              <p className="text-sm">Hozircha xabar yo'q. Birinchi bo'lib yozing!</p>
            </div>
          )}
          {groupedMessages.map((group) => (
            <div key={group.date}>
              <div className="flex justify-center my-3">
                <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                  {isToday(new Date(group.date)) ? "Bugun"
                    : isYesterday(new Date(group.date)) ? "Kecha"
                    : format(new Date(group.date), "dd.MM.yyyy")}
                </span>
              </div>
              <div className="space-y-1">
                {group.msgs.map((msg) => (
                  <MessageBubble
                    key={msg.id}
                    msg={msg}
                    isMine={msg.senderId === user?.id}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div className="border-t border-border p-3">
        {recording ? (
          <div className="flex items-center gap-3">
            <div className="flex-1 flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
              <span className="text-sm font-medium">{recordingTime}s — ovoz yozilmoqda...</span>
            </div>
            <Button
              size="icon"
              variant="destructive"
              className="h-9 w-9"
              onClick={stopRecording}
            >
              <MicOff className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-end gap-2">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) sendFile(file);
                e.target.value = "";
              }}
            />
            <Button
              size="icon"
              variant="ghost"
              className="h-9 w-9 flex-shrink-0"
              onClick={() => fileInputRef.current?.click()}
              disabled={sending}
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Xabar yozing..."
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendText();
                }
              }}
              disabled={sending}
            />
            {text.trim() ? (
              <Button
                size="icon"
                className="h-9 w-9 flex-shrink-0"
                onClick={sendText}
                disabled={sending}
              >
                <Send className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                size="icon"
                variant="ghost"
                className="h-9 w-9 flex-shrink-0"
                onMouseDown={startRecording}
                onTouchStart={startRecording}
                disabled={sending}
                title="Bosib turing — ovoz yoziladi"
              >
                <Mic className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
