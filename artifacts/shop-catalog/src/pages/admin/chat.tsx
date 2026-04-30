import { useEffect, useState } from "react";
import { ChatWindow, ChatMessage } from "@/components/chat-window";
import { useAuth } from "@/components/auth-provider";
import { useWebSocket } from "@/hooks/use-websocket";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, isToday, isYesterday } from "date-fns";


const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

interface Conversation {
  id: number;
  userId: number;
  username: string;
  displayName?: string | null;
  phone?: string | null;
  lastMessageAt: string;
  createdAt: string;
  unread?: number;
}

function formatLastTime(date: string) {
  const d = new Date(date);
  if (isToday(d)) return format(d, "HH:mm");
  if (isYesterday(d)) return "Kecha";
  return format(d, "dd.MM");
}

export default function AdminChat() {
  const { user } = useAuth();
  const { addListener } = useWebSocket(user?.id, user?.role);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [unread, setUnread] = useState<Record<number, number>>({});

  useEffect(() => {
    async function load() {
      const res = await fetch(`${BASE_URL}/api/chat/conversations`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json() as Conversation[];
        setConversations(data);
      }
    }
    load();
  }, []);

  useEffect(() => {
    if (!selected) return;
    async function loadMessages() {
      setIsLoading(true);
      try {
        const res = await fetch(`${BASE_URL}/api/chat/conversations/${selected}/messages`, { credentials: "include" });
        if (res.ok) {
          const data = await res.json() as ChatMessage[];
          setMessages(data);
        }
      } finally {
        setIsLoading(false);
      }
    }
    loadMessages();
    setUnread((prev) => ({ ...prev, [selected]: 0 }));
  }, [selected]);

  useEffect(() => {
    const unsub = addListener((data) => {
      if (data.type === "chat_message") {
        const msg = data.message as ChatMessage;
        const convId = msg.conversationId;

        setConversations((prev) => {
          const existing = prev.find((c) => c.id === convId);
          if (existing) {
            return prev.map((c) => c.id === convId ? { ...c, lastMessageAt: msg.createdAt } : c)
              .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
          }
          fetch(`${BASE_URL}/api/chat/conversations`, { credentials: "include" })
            .then((r) => r.json())
            .then((d: Conversation[]) => setConversations(d));
          return prev;
        });

        if (convId !== selected) {
          setUnread((prev) => ({ ...prev, [convId]: (prev[convId] || 0) + 1 }));
        }
      }
    });
    return unsub;
  }, [addListener, selected]);

  async function handleSend(data: FormData | { content: string }): Promise<Response> {
    if (!selected) return new Response(null, { status: 400 });
    if (data instanceof FormData) {
      return fetch(`${BASE_URL}/api/chat/conversations/${selected}/messages`, {
        method: "POST",
        credentials: "include",
        body: data,
      });
    }
    return fetch(`${BASE_URL}/api/chat/conversations/${selected}/messages`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  }

  async function handleEdit(id: number, content: string) {
    await fetch(`${BASE_URL}/api/chat/messages/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
  }

  async function handleDelete(id: number) {
    await fetch(`${BASE_URL}/api/chat/messages/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
  }

  const selectedConv = conversations.find((c) => c.id === selected);

  return (
    <div className="h-[calc(100vh-8rem)] md:h-[calc(100vh-5rem)] flex border border-border rounded-xl overflow-hidden">
      <div className="w-64 md:w-72 border-r border-border flex flex-col bg-card/30">
        <div className="p-4 border-b border-border">
          <h1 className="font-bold text-base">Chat</h1>
          <p className="text-xs text-muted-foreground">Mijozlar bilan yozishmalar</p>
        </div>
        <ScrollArea className="flex-1">
          {conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <MessageCircle className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-sm">Hozircha suhbat yo'q</p>
            </div>
          ) : conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => setSelected(conv.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-secondary/50 transition-colors border-b border-border/50",
                selected === conv.id && "bg-secondary",
              )}
            >
              <div className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 text-sm font-semibold">
                {(conv.displayName || conv.username)?.[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm truncate">
                    {conv.displayName || conv.username}
                  </p>
                  <span className="text-xs text-muted-foreground flex-shrink-0 ml-1">
                    {formatLastTime(conv.lastMessageAt)}
                  </span>
                </div>
                {conv.phone && (
                  <p className="text-xs text-muted-foreground truncate">{conv.phone}</p>
                )}
              </div>
              {(unread[conv.id] || 0) > 0 && (
                <Badge className="h-5 w-5 p-0 flex items-center justify-center text-[10px] flex-shrink-0 bg-primary">
                  {unread[conv.id]}
                </Badge>
              )}
            </button>
          ))}
        </ScrollArea>
      </div>

      <div className="flex-1 flex flex-col">
        {selected ? (
          <ChatWindow
            key={selected}
            conversationId={selected}
            messages={messages}
            onSend={handleSend}
            onEdit={handleEdit}
            onDelete={handleDelete}
            isLoading={isLoading}
            recipientName={selectedConv?.displayName || selectedConv?.username}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground flex-col gap-2">
            <MessageCircle className="h-12 w-12 opacity-20" />
            <p className="text-sm">Chap tarafdan mijozni tanlang</p>
          </div>
        )}
      </div>
    </div>
  );
}
